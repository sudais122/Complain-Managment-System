const express = require('express');
const Datastore = require('nedb-promises');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// DATABASES
const usersDb = Datastore.create({ filename: 'users.db', autoload: true });
const complaintsDb = Datastore.create({ filename: 'complaints.db', autoload: true });

console.log("✅ Local Databases Connected!");

// UPLOAD SETUP
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- ROUTES ---

// 1. REGISTER
app.post('/api/register', async (req, res) => {
    try {
        const { fullname, regNo, department, email, password } = req.body;
        const existingUser = await usersDb.findOne({ $or: [{ email: email }, { regNo: regNo }] });
        if (existingUser) return res.status(400).json({ error: "User already exists." });

        const newUser = { fullname, regNo, department, email, password, role: "Student", joined: new Date().toLocaleString() };
        await usersDb.insert(newUser);
        res.json({ message: "Registration Successful!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await usersDb.findOne({ email: email, password: password });
        if (user) {
            res.json({ message: "Login Successful", user: user });
        } else {
            res.status(401).json({ error: "Invalid Credentials" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. SUBMIT COMPLAINT
app.post('/api/submit', upload.single('image'), async (req, res) => {
    try {
        const imagePath = req.file ? `http://localhost:3001/uploads/${req.file.filename}` : null;
        
        const newComplaint = {
            email: req.body.email,
            category: req.body.category,
            location: req.body.location,
            description: req.body.description,
            imagePath: imagePath,
            status: "Pending",
            date: new Date().toLocaleString(),
            timestamp: Date.now() 
        };
        const doc = await complaintsDb.insert(newComplaint); 
        res.json({ message: "Saved!", data: doc });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. GET MY COMPLAINTS (This was likely missing!)
app.get('/api/my-complaints', async (req, res) => {
    try {
        const userEmail = req.query.email;
        // Find complaints where email matches the user
        const myIssues = await complaintsDb.find({ email: userEmail }).sort({ timestamp: -1 });
        res.json(myIssues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. GET ALL COMPLAINTS (For Admin)
app.get('/api/complaints', async (req, res) => {
    try {
        const complaints = await complaintsDb.find({}).sort({ timestamp: -1 });
        res.json(complaints);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 6. GET USERS (For Admin)
app.get('/api/users', async (req, res) => {
    try {
        const users = await usersDb.find({ role: "Student" }).sort({ joined: -1 });
        res.json(users);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 7. UPDATE STATUS (For Admin)
app.post('/api/update-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        await complaintsDb.update({ _id: id }, { $set: { status: status } });
        res.json({ message: "Updated" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 8. DELETE ALL (For Admin)
app.delete('/api/complaints', async (req, res) => {
    try {
        await complaintsDb.remove({}, { multi: true });
        res.json({ message: "Deleted All" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(3001, () => {
    console.log("🚀 Server running at http://localhost:3001");
});