import User from "../models/UserModel.js";
import Message from "../models/MassagesModel.js";
import mongoose from "mongoose";

export const searchContacts = async (request, response, next) => {
    try {
        const { searchTerm } = request.body;

        if (!searchTerm) {
            return response.status(200).json({ contacts: [] });
        }

        // تنظيف مصطلح البحث
        const sanitizedSearchTerm = searchTerm.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
        const regex = new RegExp(sanitizedSearchTerm, "i");
        
        // البحث عن المستخدمين
        const contacts = await User.find({
            $and: [
                { _id: { $ne: request.userId } }, // استثناء المستخدم الحالي
                {
                    $or: [
                        { firstName: regex },
                        { lastName: regex },
                        { username: regex }, // إضافة البحث بالـ username
                        { email: regex }
                    ]
                }
            ]
        }).select('firstName lastName username email image color'); // تحديد الحقول المطلوبة فقط

        // إرجاع النتائج
        return response.status(200).json({
            contacts: contacts.map(user => ({
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                image: user.image,
                color: user.color
            }))
        });

    } catch (error) {
        console.error("Search Error:", error);
        return response.status(500).json({ 
            message: "Internal Server Error",
            error: error.message 
        });
    }
};


export const getContactsForDMList = async (request, response, next) => {
    try {
        let {userId} = request;
        userId = new mongoose.Types.ObjectId(userId);

        // Find all messages where the current user is either sender or recipient
        const contacts = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: userId },
                        { recipient: userId }
                    ]
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $eq: ["$sender", userId] },
                            then: "$recipient",
                            else: "$sender"
                        }
                    },
                    lastMessage: { $first: "$content" },
                    lastMessageTime: { $first: "$timestamp" }
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userDetails"
                },
            },
             {
                $unwind: "$userDetails",
             },
             {
                $project: {
                    _id: 1,
                    firstName: "$userDetails.firstName",   
                    lastName: "$userDetails.lastName",
                    username: "$userDetails.username",
                    email: "$userDetails.email",
                    image: "$userDetails.image",
                    color: "$userDetails.color",
                    lastMessage: 1,
                    lastMessageTime: 1
                },
             },
             {
                $sort: { lastMessageTime: -1 }
             },
        ]);

        // Get user details for each contact
        const contactDetails = await User.find({
            _id: { $in: contacts.map(contact => contact._id) }
        }).select('firstName lastName username email image color');

        // Combine message and user details
        const contactList = contacts.map(contact => {
            const userDetails = contactDetails.find(user => 
                user._id.toString() === contact._id.toString()
            );
            return {
                ...userDetails.toObject(),
                lastMessage: contact.lastMessage,
                lastMessageTime: contact.lastMessageTime
            };
        });

        return response.status(200).json({ contacts: contactList });

    } catch (error) {
        console.error("Search Error:", error);
        return response.status(500).json({ 
            message: "Internal Server Error",
            error: error.message 
        });
    }
};