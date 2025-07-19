const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });

const authenticate = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token)
    return res.send({
      mess: "error",
      status: 400,
      text: "Invalid Token",
    });

  try {
    const decoded = jwt.verify(token, process.env.JWTKEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.send({
      mess: "error",
      status: 400,
      text: "Invalid Token",
    });
  }
};

const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.send({
            mess: "error",
            status: 400,
            text: "Invalid Token",
          });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
