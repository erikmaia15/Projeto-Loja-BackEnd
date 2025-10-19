import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // ✅ Verificação segura sem logs desnecessários
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token de acesso não fornecido" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decodificar = jwt.verify(token, JWT_SECRET);

    if (!decodificar.isAdmin) {
      return res
        .status(403)
        .json({ message: "Privilégios de administrador necessários" });
    }

    // ✅ Opcional: Adicionar usuário decodificado ao request
    req.user = decodificar;
    next();
  } catch (error) {
    console.log("Erro na verificação do token:", error.message);
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
};

export default auth;
