---
fullname: ${name.familyName}, ${name.givenName}
emails:
${emails[].`  - ${value} (${tag??Unknown})`}
mailto:
${emails[].`  - <a href="mailto:%22${name.familyName},%20${name.givenName}%22%20%3c${value}%3e">${tag??Mailto}</a>`}
phone:
${telephones[].`  - <a href="tel:${value}">${tag??Phone}</a>`}
organization:
${organization[].`  - ${value}`}
title: ${title[].value}
addresses:
${addresses[].`  - ${tag}: ${value}`}
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
