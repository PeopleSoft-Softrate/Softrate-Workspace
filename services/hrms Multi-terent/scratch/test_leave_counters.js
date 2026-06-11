const mongoose = require("mongoose");
const LeaveCounter = require("../models/leaveCounter.model.js");

mongoose.connect("mongodb+srv://user:pass@cluster.mongodb.net/masterDB?retryWrites=true&w=majority") 
// wait, I can just use the db connection from server.js or db.js.
