import Message from "../models/MassagesModel.js";
import { mkdirSync, renameSync } from "fs";
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const date = new Date().toISOString().split('T')[0];
    const dir = `uploads/files/${date}`;
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

export const getMessages = async (request, response, next) => {
  try {
    const user1 = request.userId;
    const user2 = request.body.id;
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 30; // تغيير إلى 30 مثلاً
    const skip = (page - 1) * limit;

    if (!user1 || !user2) {
      console.log(`Fetching messages - Page: ${page}, Limit: ${limit}, Skip: ${skip}`);
      return response.status(400).send("Both user ID's are required.");
    }

    // تحديد شرط البحث المشترك
    const messageQuery = {
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 },
      ],
    };

    // جلب إجمالي عدد الرسائل
    const totalMessages = await Message.countDocuments(messageQuery);

    // جلب الرسائل مع Pagination
    const messages = await Message.find(messageQuery)
    .populate({
      path: "sender",
      select: "id _id email username firstName lastName image color"
    })
    .populate({
      path: "recipient", 
      select: "id _id email username firstName lastName image color"
    })
    .sort({ timestamp: -1 }) // ترتيب تنازلي (الأحدث أولاً)
    .skip(skip)
    .limit(limit);

    // تحديث حالة الرسائل غير المقروءة
    const messagesToUpdate = messages.filter(
      msg => {
        return msg.recipient.toString() === user1 && 
               msg.status !== "read" && 
               global.onlineUsers?.has(user1) // تحقق من أن المستخدم متصل
      }
    );

    if (messagesToUpdate.length > 0) {
      // تحديث فقط إلى delivered إذا لم يكن المستخدم في المحادثة
      const newStatus = "delivered";
      
      await Message.updateMany(
        {
          _id: { $in: messagesToUpdate.map(msg => msg._id) }
        },
        {
          $set: { status: newStatus }
        }
      );

      // إرسال إشعارات تحديث الحالة
      if (global.io && global.userSocketMap) {
        const senderSocket = global.userSocketMap.get(user2);
        if (senderSocket) {
          messagesToUpdate.forEach(msg => {
            global.io.to(senderSocket).emit("messageStatus", {
              messageId: msg._id,
              status: newStatus
            });
          });
        }
      }
    }

    // تحليل أداء الاستعلام
    const explain = await Message.find(messageQuery).explain('executionStats');

    console.log('Query Performance:', {
      executionTimeMillis: explain.executionStats.executionTimeMillis,
      totalDocsExamined: explain.executionStats.totalDocsExamined,
      nReturned: explain.executionStats.nReturned
    });

    return response.status(200).json({
      messages: messages.reverse(), // إعادة الترتيب للعرض
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        hasMore: totalMessages > skip + limit
      }
    });
  } catch (error) {
    console.error("Error in getMessages:", error);
    return response.status(500).send("Internal Server Error");
  }
};


export const uploadFile = async (request, response, next) => {
  try {
    console.log('Request file:', request.file); // للتحقق
    
    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' });
    }

    return response.status(200).json({ 
      filePath: request.file.path.replace(/\\/g, '/'),
      fileName: request.file.originalname 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
};

