import { Router } from "express";

const router = Router();

router.post("/demo-session", async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production" || req.app.locals.data.mode !== "demo") {
      return res.status(404).json({ message: "The local applicant preview is not available." });
    }

    const user = await req.app.locals.data.getUserById(1);
    if (!user || user.role !== "applicant") {
      return res.status(404).json({ message: "The demonstration applicant is not available." });
    }

    req.session.regenerate((sessionError) => {
      if (sessionError) return next(sessionError);
      req.session.userId = user.id;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ user });
      });
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    if (!req.session.userId) return res.status(401).json({ message: "No active applicant session." });
    const user = await req.app.locals.data.getUserById(req.session.userId);
    if (!user || user.role !== "applicant") return res.status(401).json({ message: "No active applicant session." });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("jrs.sid");
    res.status(204).end();
  });
});

export default router;
