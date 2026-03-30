const http=require("http"); //as websocket needs http server to run
const express=require("express");

const app=express();
const path=require("path");
const { Server } = require("socket.io");

const server=http.createServer(app);
const io=new Server(server);


//database
const mongoose=require("mongoose");

mongoose.connect("mongodb://localhost:27017/ChatBoomDB")
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.error("Could not connect to MongoDB", err)); 

const user_chat_schema=new mongoose.Schema({
    name: { type: String, required: true },
    msg: { type: String, required: true },
    room: { type: String, required: true ,index: true}, //indexing for fast access
    time: { type: Date, default: Date.now }
});
const user_chat_model=mongoose.model("UserChatDB", user_chat_schema);

let users = {};//list of the users in room

io.on("connection", (socket) => {

    socket.on("join_room", async ({ name, room }) => {
        socket.join(room);

        //fetch previous msgs
        const previousMessages = await user_chat_model.find({ room }).sort({ time: -1 }).limit(50); //fetch last 50 messages,negative for latest first
        socket.to(room).emit("previous_messages", previousMessages.reverse()); //send in reverse order to show latest first

        users[socket.id] = { name, room };

        // send updated users list with ppl in same room
        const roomUsers = Object.values(users)
            .filter(u => u.room === room)
            .map(u => u.name);

        io.to(room).emit("room_users", roomUsers);
    });

    socket.on("disconnect", () => {
        const user = users[socket.id];
        if (user) {
            delete users[socket.id];
            //showing theupdated list
            const roomUsers = Object.values(users)
                .filter(u => u.room === user.room)
                .map(u => u.name);

            io.to(user.room).emit("room_users", roomUsers);
        }
    });

    socket.on("message", async (data) => {
        // Save the message to the database
        const user = users[socket.id];
if (!user || !data.msg) return;

const messageData = {
    name: user.name,
    room: user.room,
    msg: data.msg
};

        try {
            const newMessage = new user_chat_model(messageData);
            await newMessage.save();
        } catch (err) {
            console.error("Error saving message:", err);
        return;
        }

        //as the room was not defined directly in the client, we need to get it from the users object
        io.to(user.room).emit("receive_message", messageData);
    });
});

app.use(express.static(path.resolve("./public")));//files directly accessible to browser

//route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(3000,()=>{
    console.log("Server is running on port 3000");
});





