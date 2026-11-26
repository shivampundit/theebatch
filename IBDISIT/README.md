# SIDBI Grade A/B (IT Stream) 2026 — Exam Preparation Web Portal

Pure static HTML5, CSS3, and Vanilla JS study portal designed for direct deployment on **GitHub Pages** (zero build tools).

## Repository Folder Structure

```text
sidbi-it-2026-portal/
├── index.html                                   # Main Dashboard, Countdown & 4-Cluster Progress Tracker
├── README.md                                    # Deployment guide & syllabus file map
├── assets/
│   ├── style.css                                # Theme, yellow <mark> highlights, dark mode, print-clean CSS
│   └── app.js                                   # Countdown, localStorage tracker, TOC spy, MCQ & Descriptive engines
├── descriptive/
│   └── practice-lab.html                        # Paper II & Paper III Typing Simulator + AI-Evaluation Rubric
├── notes/                                       # 25 Official IT Topic Chapter Notes (Clusters 1–4)
│   ├── cluster1-ch01-intro-software.html
│   ├── cluster1-ch02-computer-fundamentals.html
│   ├── cluster1-ch03-data-structures.html
│   ├── cluster1-ch04-programming-languages.html
│   ├── cluster1-ch05-oops.html
│   ├── cluster1-ch06-daa.html
│   ├── cluster1-ch07-operating-systems.html
│   ├── cluster2-ch08-dbms-rdbms.html
│   ├── cluster2-ch09-networking.html
│   ├── cluster2-ch10-architecture.html
│   ├── cluster2-ch11-cyber-security.html
│   ├── cluster3-ch12-sad.html
│   ├── cluster3-ch13-software-engineering.html
│   ├── cluster3-ch14-mis.html
│   ├── cluster3-ch15-api-usage.html
│   ├── cluster3-ch16-app-development.html
│   ├── cluster4-ch17-ai-ml.html
│   ├── cluster4-ch18-nlp.html
│   ├── cluster4-ch19-big-data.html
│   ├── cluster4-ch20-data-modelling.html
│   ├── cluster4-ch21-data-visualisation.html
│   ├── cluster4-ch22-data-warehousing.html
│   ├── cluster4-ch23-statistical-computing.html
│   ├── cluster4-ch24-iot.html
│   └── cluster4-ch25-mobile-computing.html
├── mocks/                                       # Interactive 5-Option CBT Objective Mocks (-0.25 Neg.)
│   ├── phase1-full-mock-01.html
│   ├── paper3-cluster1-mock.html
│   ├── paper3-cluster2-mock.html
│   ├── paper3-cluster3-mock.html
│   ├── paper3-cluster4-mock.html
│   └── paper3-full-mock-01.html
└── revision/                                    # Master Revision & Formula Hub
    ├── sql-cheatsheet.html
    ├── networking-ports-subnetting.html
    ├── os-formulas-scheduling.html
    ├── cyber-rbi-certin-dpdp.html
    └── sidbi-msme-schemes.html
```

## Quick Deployment on GitHub Pages
1. Extract this folder into your repository root (or a subfolder such as `/sidbi-it-2026/`).
2. Commit and push to `main`.
3. Enable **Settings → Pages → Deploy from a branch (`main` / root)**.
