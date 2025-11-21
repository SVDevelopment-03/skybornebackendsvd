import { parsePhoneNumberFromString } from "libphonenumber-js";
import { BadRequestError } from "../handlers/httpError.handler";
import { getName } from "country-list";  // <-- converts ISO code to full name


export default function extractPhoneDetails(fullNumber: string) {
  const phone = parsePhoneNumberFromString(fullNumber);
  

  if (!phone) {
    throw new BadRequestError("Invalid phone number");
  }
    const isoCode = phone.country; // "IN"
    const countryName = isoCode ? getName(isoCode) : null; // "India"

  return {
    fullNumber: phone.number,           // +919876543210
    dialingCode: `+${phone.countryCallingCode}`,  // +91
    localNumber: phone.nationalNumber,  // 9876543210
    countryCode: phone.country,          // IN
    country:countryName || "Unknown",
  };
}
