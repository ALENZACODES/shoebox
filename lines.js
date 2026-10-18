/* Form T2125 expense lines, from the CRA's "Expenses section of form T2125":
   https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/completing-form-t2125/expenses-section-form-t2125.html
   "hints" are short example phrases the model compares each transaction against. */
const LINES = [
  { id: "8521", name: "Advertising", hints: ["Google Ads", "Facebook ads Meta advertising", "Instagram promoted post", "printing flyers and business cards", "LinkedIn ads"] },
  { id: "8523", name: "Meals and entertainment", share: 0.5, hints: ["restaurant lunch with client", "coffee shop", "Tim Hortons", "Starbucks", "Uber Eats food delivery", "bar and grill dinner"] },
  { id: "8690", name: "Insurance", hints: ["business liability insurance premium", "professional insurance policy", "errors and omissions insurance"] },
  { id: "8710", name: "Interest and bank charges", hints: ["monthly account fee", "bank service charge", "interest charge", "Stripe fee", "PayPal fee", "Square processing fee", "Interac e-transfer fee"] },
  { id: "8760", name: "Business taxes, licences and memberships", hints: ["business licence renewal", "professional association membership dues", "chamber of commerce membership", "business name registration"] },
  { id: "8810", name: "Office expenses", hints: ["software subscription", "Adobe Creative Cloud", "Microsoft 365", "Canva Pro", "Dropbox", "Google Workspace", "Zoom subscription", "domain name and web hosting"] },
  { id: "8811", name: "Office stationery and supplies", hints: ["Staples office supplies", "printer ink and paper", "pens notebooks envelopes", "Canada Post stamps"] },
  { id: "8860", name: "Professional fees", hints: ["accountant fee", "bookkeeping service", "lawyer legal fees", "tax preparation"] },
  { id: "8910", name: "Rent", hints: ["coworking space membership", "studio rent", "office rent", "WeWork"] },
  { id: "8960", name: "Repairs and maintenance", hints: ["laptop repair", "equipment repair", "camera servicing"] },
  { id: "9200", name: "Travel expenses", hints: ["Air Canada flight", "WestJet airfare", "hotel stay", "Airbnb for conference", "VIA Rail train ticket", "taxi to airport"] },
  { id: "9220", name: "Utilities", hints: ["Rogers internet", "Bell mobile phone bill", "Telus wireless", "Hydro electricity bill", "Enbridge gas bill"] },
  { id: "9275", name: "Delivery, freight and express", hints: ["Canada Post parcel shipping", "Purolator courier", "UPS shipping label", "FedEx delivery"] },
  { id: "9281", name: "Motor vehicle expenses", hints: ["gas station fuel Petro-Canada", "Esso Shell gas", "car insurance", "oil change", "407 ETR toll", "parking Green P", "car wash"] },
  { id: "9270", name: "Other expenses", hints: ["online course for work", "conference ticket", "stock photos", "music licence for videos"] },
  { id: "personal", name: "Personal (not deductible)", hints: ["grocery store Loblaws No Frills", "Netflix", "Spotify", "clothing store", "gym membership", "LCBO", "personal pharmacy Shoppers Drug Mart", "rent for my apartment"] },
  { id: "income", name: "Income or transfer (skip)", hints: ["client payment received", "e-transfer from client", "deposit", "Stripe payout", "transfer from savings", "invoice paid"] }
];
if (typeof module !== "undefined") module.exports = LINES;
