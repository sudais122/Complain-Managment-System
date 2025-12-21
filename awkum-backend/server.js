const express = require('express');
const Datastore = require('nedb-promises');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const usersDb = Datastore.create({ filename: 'users.db', autoload: true });
const complaintsDb = Datastore.create({ filename: 'complaints.db', autoload: true });

console.log("✅ Local Databases Connected!");

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.post('/api/register', async (req, res) => {
    try {
        console.log("Received Registration:", req.body);
        const { fullname, regNo, department, email, password } = req.body;
        const existingUser = await usersDb.findOne({ $or: [{ email: email }, { regNo: regNo }] });
        if (existingUser) return res.status(400).json({ error: "User already exists." });

        const newUser = { fullname, regNo, department, email, password, role: "Student", joined: new Date() };
        await usersDb.insert(newUser);
        res.json({ message: "Registration Successful!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await usersDb.find({ role: "Student" }).sort({ joined: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/submit', upload.single('image'), async (req, res) => {
    try {
        const imagePath = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : null;
        const newComplaint = {
            category: req.body.category,
            location: req.body.location,
            description: req.body.description,
            imagePath: imagePath,
            status: "Pending",
            date: new Date(),
        };
        const doc = await complaintsDb.insert(newComplaint); 
        res.json({ message: "Saved!", data: doc });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/complaints', async (req, res) => {
    try {
        const complaints = await complaintsDb.find({}).sort({ date: -1 });
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        await complaintsDb.update({ _id: id }, { $set: { status: status } });
        res.json({ message: "Updated" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3001, () => {
    console.log("🚀 Server running at http://localhost:3001");
});