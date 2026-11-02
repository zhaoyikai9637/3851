import { useEffect, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import { locationParts } from "../../shared/contactFields";
import api from "../api/client";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function PhoneField({ value, onChange }) {
  const parsed = parsePhoneNumberFromString(value || "");
  const [country, setCountry] = useState(parsed?.country || "SG");
  const callingCode = getCountryCallingCode(country);
  const prefix = `+${callingCode}`;
  const national = value?.startsWith(prefix) ? value.slice(prefix.length).replace(/\s/g, "") : (parsed?.nationalNumber || value || "");
  return <div className="d-flex gap-2 flex-wrap">
    <select aria-label="Phone country calling code" className="form-select" style={{ flex: "1 1 180px", width: 180 }} value={country} onChange={(event) => { setCountry(event.target.value); onChange(`+${getCountryCallingCode(event.target.value)}${national}`); }}>
      {getCountries().sort((a, b) => countryNames.of(a).localeCompare(countryNames.of(b))).map((code) => <option key={code} value={code}>{countryNames.of(code)} (+{getCountryCallingCode(code)})</option>)}
    </select>
    <input aria-label="National phone number" className="form-control" style={{ flex: "1 1 180px", width: 180 }} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={20} placeholder="Phone number" value={national} onChange={(event) => {
      const input = event.target.value.trim();
      if (input.startsWith("+")) {
        const pasted = parsePhoneNumberFromString(input);
        if (pasted?.country) setCountry(pasted.country);
        onChange(input);
      } else onChange(input ? prefix + input.replace(/[^0-9]/g, "") : "");
    }} />
  </div>;
}

export function LocationField({ value, onChange }) {
  const [country, state, city] = locationParts(value);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get("/options/locations").then(({ data }) => { if (active) setCountries(data.options); }).catch(() => { if (active) setError("Location options could not be loaded. Reload the page to retry."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setStates([]); setCities([]);
    if (country) api.get("/options/locations", { params: { country } }).then(({ data }) => { if (active) setStates(data.options); }).catch(() => { if (active) setError("State options could not be loaded. Select the country again to retry."); });
    return () => { active = false; };
  }, [country]);
  useEffect(() => {
    let active = true;
    setCities([]);
    if (country && state) api.get("/options/locations", { params: { country, state } }).then(({ data }) => { if (active) setCities(data.options); }).catch(() => { if (active) setError("City options could not be loaded. Select the state again to retry."); });
    return () => { active = false; };
  }, [country, state]);
  return <div className="d-grid gap-2">
    {error && <span role="alert" className="text-danger">{error}</span>}
    <select aria-label="Country of residence" className="form-select" value={country} onChange={(event) => onChange(JSON.stringify([event.target.value, "", ""]))}>
      <option value="">Select country</option>{countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select>
    {states.length > 0 && <select aria-label="State or province" className="form-select" value={state} onChange={(event) => onChange(JSON.stringify([country, event.target.value, ""]))}>
      <option value="">State / province (optional)</option>{states.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select>}
    {cities.length > 0 && <select aria-label="City" className="form-select" value={city} onChange={(event) => onChange(JSON.stringify([country, state, event.target.value]))}>
      <option value="">City (optional)</option>{cities.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select>}
  </div>;
}
