---
fullname: ${name.familyName}, ${name.givenName}
email: ${emails[0]`${value} (${tag??Unknown})`}
mailto: ${emails[0].`<a href="mailto:%22${name.familyName},%20${name.givenName}%22%20%3c${value}%3e">${tag??Mailto}</a>`}
phone: ${telephones[0].`<a href="tel:${value}">${tag??Phone}</a>`??No Phone}
organization: ${organization[0].`${value}`}
title: ${title[0].value}
addresses: ${addresses[0].`${tag}: ${value}`}
---
## 👤 ${name.familyName}, ${name.givenName}
- 📧 Emails:
${emails[].`	- <a href="mailto:%22${name.familyName},%20${name.givenName}%22%20%3c${value}%3e">${tag??Mail}</a>`}
- ☎️ Phone:
${telephones[].`	- <a href="tel:${value}">${tag??Phone}</a>`}
- 🏢 Organization:
${organization[].`	- ${value}`}
- 📛 Title: ${title[].value}
- 🏠 Addresses:
${addresses[].`	- ${tag}: ${value}`}
