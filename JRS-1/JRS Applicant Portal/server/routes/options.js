import { Router } from "express";
import { Country, State, City } from "../data/locationFields.js";
const router = Router();
router.get("/locations", (req, res) => {
  const { country, state } = req.query;
  if ((country !== undefined && (typeof country !== "string" || !Country.getCountryByCode(country))) || (state !== undefined && (typeof state !== "string" || !State.getStateByCodeAndCountry(state, country)))) {
    return res.status(422).json({ message: "Invalid country or state." });
  }
  res.set("Cache-Control", "public, max-age=3600");
  if (!country) return res.json({ options: Country.getAllCountries().map((item) => ({ code: item.isoCode, name: item.name })) });
  if (!state) return res.json({ options: State.getStatesOfCountry(country).map((item) => ({ code: item.isoCode, name: item.name })) });
  return res.json({ options: [...new Set(City.getCitiesOfState(country, state).map((item) => item.name))].map((name) => ({ code: name, name })) });
});
export default router;
