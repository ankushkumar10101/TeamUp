const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const { user, token } = await authService.registerUser({ name, email, password, role });

    res.cookie('token', token, authService.getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      user,
      token,
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.loginUser({ email, password });

    res.cookie('token', token, authService.getCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      user,
      token,
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res) => {
  const { maxAge, ...cookieOptions } = authService.getCookieOptions();
  res.clearCookie('token', cookieOptions);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
