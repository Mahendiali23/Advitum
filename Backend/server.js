require('dotenv').config({ path: require('fs').existsSync(require('path').join(__dirname, '.env')) ? require('path').join(__dirname, '.env') : require('path').join(__dirname, '../.env') });

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

// Models mapping
const Item = require('./models/items'); 
const Category = require('./models/category');

const app = express();

// --- SYSTEM CONFIGURATION VARIABLES ---
const PORT = process.env.PORT || 3000;
const DB_CONNECTION_STRING = process.env.MONGODB_URI;

// ------------------- MIDDLEWARE -------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Views parsing configuration
app.set('views', [
    path.join(__dirname, '..', 'Frontend', 'user', 'views'),
    path.join(__dirname, '..', 'Frontend', 'admin', 'views')
]);
app.set('view engine', 'ejs');

// STATIC FILES CONFIGURATION
// 1. Static assets from 'Frontend/public' (CSS, Frontend JS, etc.)
app.use(express.static(path.join(__dirname, '..', 'Frontend', 'public')));

// 2. Uploaded Images from 'back/public'
const uploadPath = path.join(__dirname, 'public', 'uploads');
app.use(express.static(path.join(__dirname, 'public')));

// Auto-create 'back/public/uploads' folder if it doesn't exist
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// ------------------- MULTER STORAGE CONFIGURATION -------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath); // Stores files in back/public/uploads
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Helper function to handle image array formatting from body inputs (Fallback)
const formatImageArray = (imagesInput) => {
    if (!imagesInput) return [];
    if (Array.isArray(imagesInput)) {
        return imagesInput.filter(url => url && url.trim() !== '').slice(0, 3);
    }
    if (typeof imagesInput === 'string') {
        return imagesInput.split(',').map(url => url.trim()).filter(url => url !== '').slice(0, 3);
    }
    return [];
};

// ------------------- USER SIDE ROUTES -------------------
app.get('/home', (req, res) => res.render('home'));
app.get('/', (req, res) => res.render('home'));
app.get('/about', (req, res) => res.render('about'));

app.get('/product', async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        const items = await Item.find().populate('category').sort({ name: 1 });

        res.render('product', { items, categories });
    } catch (err) {
        res.status(500).send("Error rendering product catalog: " + err.message);
    }
});

app.get('/label', (req, res) => res.render('label'));
app.get('/exportservices', (req, res) => res.render('exportservices'));
app.get('/certifications', (req, res) => res.render('certifications'));
app.get('/division', (req, res) => res.render('division'));
app.get('/blog', (req, res) => res.render('blog'));
app.get('/contact', (req, res) => res.render('contact'));
app.get('/company', (req, res) => res.render('company'));
app.get('/services', (req, res) => res.render('services'));

// ------------------- ADMIN SIDE ROUTES -------------------

app.get('/admin/login', (req, res) => {
    res.render('login');
});

// READ: Dashboard
app.get('/admin/dashboard', async (req, res) => {
    try {
        const items = await Item.find().populate('category').sort({ createdAt: -1 });
        const categories = await Category.find().sort({ name: 1 });
        
        const totalItems = items.length;
        const totalValue = items.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
        const inquiries = []; 

        res.render('dashboard', { 
            items, 
            categories, 
            totalItems, 
            totalValue, 
            inquiries 
        });
    } catch (err) {
        res.status(500).send("Dashboard render error: " + err.message);
    }
});

// CATEGORY CREATE: Render Form
app.get('/admin/categories/new', (req, res) => {
    res.render('new-category');
});

// CATEGORY CREATE: Handle Post Data
app.post('/admin/categories', async (req, res) => {
    try {
        const newCategory = new Category(req.body);
        await newCategory.save();
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.status(400).send("Failed to create category: " + err.message);
    }
});

// CATEGORY DELETE: Delete Action
app.post('/admin/categories/:id/delete', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.status(500).send("Failed to delete category: " + err.message);
    }
});

// ITEM CREATE: Render Form
app.get('/admin/items/new', async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('new-item', { categories });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ITEM CREATE: Handle Post Data with Image Upload
app.post('/admin/items', upload.array('images', 3), async (req, res) => {
    try {
        const itemData = { ...req.body };

        if (req.files && req.files.length > 0) {
            itemData.images = req.files.map(file => '/uploads/' + file.filename);
        } else {
            itemData.images = [];
        }

        const newItem = new Item(itemData);
        await newItem.save();

        res.redirect('/admin/dashboard');
    } catch (err) {
        res.status(400).send("Save validation error: " + err.message);
    }
});

// ITEM UPDATE: Render Form
app.get('/admin/items/:id/edit', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        const categories = await Category.find();
        if (!item) return res.status(404).send('Item not found');
        res.render('edit-item', { item, categories });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ITEM UPDATE: Process Action with Multer Middleware
app.post('/admin/items/:id/update', upload.array('images', 3), async (req, res) => {
    try {
        const itemData = { ...req.body };

        if (req.files && req.files.length > 0) {
            itemData.images = req.files.map(file => '/uploads/' + file.filename);
        } else if (req.body.images) {
            itemData.images = formatImageArray(req.body.images);
        }

        await Item.findByIdAndUpdate(req.params.id, itemData, { runValidators: true, new: true });
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.status(400).send("Update failed: " + err.message);
    }
});

// ITEM DELETE: Delete Action
app.post('/admin/items/:id/delete', async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ------------------- DB CONNECTION & SERVER START -------------------
mongoose.connect(DB_CONNECTION_STRING)
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running smoothly on http://localhost:${PORT}/home`);
            console.log(`Admin dashboard: http://localhost:${PORT}/admin/dashboard`);
        });
    })
    .catch(err => console.error("Database connection failed:", err));