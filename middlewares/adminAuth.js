import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
const auth = (req, res, next) => {
  const token = req.headers.authorization;
  console.log(token);
  if (!token) {
    return res.status(401).json({ message: "acesso negado" });
  }
  try {
    const decodificar = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    if (decodificar.isAdmin === true) {
      next();
    } else {
      return res
        .status(400)
        .json({ message: "Sem privilégios de administrador" });
    }
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Token inválido!!" });
  }
};

export default auth;
