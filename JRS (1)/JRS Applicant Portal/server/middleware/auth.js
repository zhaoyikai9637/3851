export async function requireApplicant(req, res, next) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Please sign in to continue." });
    }

    const user = await req.app.locals.data.getUserById(req.session.userId);
    if (!user || user.role !== "applicant") {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Your applicant session is no longer valid." });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
