const express = require('express');
const router = express.Router();
const db = require('../db');

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

// POST /api/auth/login - Login para clientes
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = getConfig('client_username');
  const validPass = getConfig('client_password');

  if (username === validUser && password === validPass) {
    req.session.user = { username };
    return res.json({ ok: true, redirect: '/' });
  }
  res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
});

// POST /api/auth/admin/login - Login para administrador
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = getConfig('admin_username');
  const validPass = getConfig('admin_password');

  if (username === validUser && password === validPass) {
    req.session.admin = { username };
    return res.json({ ok: true, redirect: '/admin' });
  }
  res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true, redirect: '/login.html' });
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  res.json({
    isUser: !!req.session.user,
    isAdmin: !!req.session.admin,
  });
});

module.exports = router;
