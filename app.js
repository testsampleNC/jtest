const express = require('express');
const path = require('path'); // Added for serving static files
const { authenticate, isAdmin } = require('./src/middleware/auth'); // Import middleware

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files for user and admin views
app.use('/user', express.static(path.join(__dirname, 'src/views/user')));
app.use('/admin', express.static(path.join(__dirname, 'src/views/admin')));

// Import ticket routes
const ticketRoutes = require('./src/routes/ticketRoutes');

// Simple route for root
app.get('/', (req, res) => {
  res.send('LINE Mini-App Backend is running!');
});

// Protected route for user profile
app.get('/api/profile', authenticate, (req, res) => {
  res.json(req.user);
});

// Protected route for admin dashboard
app.get('/api/admin/dashboard', authenticate, isAdmin, (req, res) => {
  res.json({ message: 'Welcome to the admin dashboard!', user: req.user });
});

// Mount ticket routes
app.use('/api/tickets', ticketRoutes); // All routes in ticketRoutes will be prefixed with /api/tickets

// Import admin routes
const adminRoutes = require('./src/routes/adminRoutes');

// Mount admin routes
app.use('/api/admin', adminRoutes); // All routes in adminRoutes will be prefixed with /api/admin

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log('User view available at http://localhost:3000/user/');
  console.log('Admin view available at http://localhost:3000/admin/');
});
