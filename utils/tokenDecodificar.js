import jwt from "jsonwebtoken";

export default {
  async decodedToken(token) {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!token) {
      return "Sem token";
    }
    try {
      const userInfos = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
      return userInfos;
    } catch (error) {
      console.log(error);
      return "Algum error";
    }
  },
};
