---
tags: [Meetings]
meetingDate: ${startDate|yyyy-MM-dd HH:mm}
uid: ${uid}
parent: "[[${startDate|yyyy-MM-dd-eeee}]]"
previous: "${previousEventLink}"
project:
---
### **Next Actions**

### Participants %% fold %%
${attendeeList[].` - [ ] [[${name??Unknown}]]`}
### Agenda
```insta-toc
---
title:
  name: ""
  level: 1
  center: false
exclude: ""
style:
  listType: dash
omit: []
levels:
  min: 1
  max: 6
---

#

- Next Actions
- Participants %% fold %%
- Agenda
- Previous Next Actions
- Notes
```
### *Previous Next Actions*

### Notes

${carryForward}
