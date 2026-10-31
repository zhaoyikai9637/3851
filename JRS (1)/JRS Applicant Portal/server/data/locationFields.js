import { Country, State, City } from "country-state-city";
import { locationParts } from "../../shared/contactFields.js";
export { Country, State, City };
export function canonicalLocation(value) {
  const [country, state, city] = locationParts(value);
  if (![country, state, city].every((item) => typeof item === "string") || !Country.getCountryByCode(country)) throw new Error("Select a valid country.");
  if (state && !State.getStateByCodeAndCountry(state, country)) throw new Error("Select a state belonging to the selected country.");
  if (city && (!state || !City.getCitiesOfState(country, state).some((item) => item.name === city))) throw new Error("Select a city belonging to the selected state.");
  return JSON.stringify([country, state, city]);
}
