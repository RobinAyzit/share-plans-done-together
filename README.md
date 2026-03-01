# 🚀 DoneTogether - Smart Task Management

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Version](https://img.shields.io/badge/version-1.0.0-green.svg) ![Status](https://img.shields.io/badge/status-Active-success.svg)

**DoneTogether** är en modern och intelligent uppgiftshanterare designad för att göra planering och samarbete enkelt, snabbt och roligt. Oavsett om det gäller familjens veckohandling, teamets projektplanering eller din personliga "att-göra"-lista, hjälper DoneTogether dig att få saker gjorda – tillsammans.

---

## 💡 Vad är DoneTogether?

DoneTogether är mer än bara en att-göra-lista. Det är ett **Smart Task**-verktyg som synkroniserar dina planer i realtid över alla enheter. Med fokus på användarvänlighet och visuell feedback gör appen det enkelt att organisera vardagen.

### ✨ Huvudfunktioner

*   **🔄 Realtidssynkronisering:** Alla ändringar uppdateras omedelbart för alla inbjudna deltagare. Ingen fördröjning, inget krångel.
*   **👥 Smart Samarbete:** Bjud in vänner och familj via e-post eller unika länkar. Arbeta tillsammans i delade listor.
*   **📸 Visuell Planering:** Ladda upp bilder till uppgifter för att tydliggöra vad som ska göras eller för att fira framsteg.
*   **📱 Plattformsoberoende:** Fungerar sömlöst på Android, iOS (via webb) och Desktop.
*   **🎨 Modern Design:** Ett snyggt, mörkt tema (Dark Mode) som är skonsamt för ögonen och batteriet.
*   **🔒 Säkerhet:** All data lagras säkert med Google Firebase och all kommunikation är krypterad.
*   **🧹 Auto-städning:** Slutförda listor arkiveras automatiskt för att hålla din vy ren och fokuserad.

---

## 📸 Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/RobinAyzit/DoneTogether/master/screenshot/login.png" alt="Login" width="200"/>
  <img src="https://raw.githubusercontent.com/RobinAyzit/DoneTogether/master/screenshot/create.png" alt="Create Task" width="200"/>
  <img src="https://raw.githubusercontent.com/RobinAyzit/DoneTogether/master/screenshot/creat2.png" alt="Task Details" width="200"/>
</p>

---

## 🛠️ Teknisk Stack

Projektet är byggt med den senaste och mest robusta tekniken för att garantera prestanda och skalbarhet:

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS, Framer Motion
*   **Backend & Databas:** Google Firebase (Firestore, Auth, Storage)
*   **Mobil:** Capacitor (Android/iOS native wrapper)

---

## 🚀 Installation & Kom Igång

Följ dessa steg för att köra projektet lokalt på din dator.

### Förutsättningar
*   Node.js (v18+)
*   npm eller yarn
*   Android Studio (för mobil utveckling)

### Steg-för-steg

1.  **Klona repot**
    ```bash
    git clone https://github.com/RobinAyzit/DoneTogether.git
    cd DoneTogether
    ```

2.  **Installera beroenden**
    ```bash
    npm install
    ```

3.  **Konfigurera Firebase**
    *   Skapa ett projekt i [Firebase Console](https://console.firebase.google.com).
    *   Kopiera din konfiguration till `src/lib/firebase.ts`.
    *   Aktivera Google Auth och Firestore Database.

4.  **Starta webbservern**
    ```bash
    npm run dev
    ```

5.  **Bygg för Android (Valfritt)**
    ```bash
    npm run build
    npx cap sync
    npx cap open android
    ```

---

📄 License 
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 

👨‍💻 Author 
Created 2026 by © nRn World 

📧 bynrnworld@gmail.com 

🙏 Support 
If you like this project, consider to: 

⭐ Star the project on GitHub 
☕ Buy me a coffee 
📢 Share with your friends
