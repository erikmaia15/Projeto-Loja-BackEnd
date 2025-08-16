import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: "Acesso negado" });
  }
  try {
    const decodificar = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    req.user = decodificar; // coloca dados do usuário na req
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Token inválido" });
  }
};

export default auth;
