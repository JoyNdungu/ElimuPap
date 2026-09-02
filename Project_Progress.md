# Project Overview

ElimuPap is an academic-assistant web application designed to provide students with a focused digital space for account access, progress tracking, study planning, and learning-related navigation. The system uses a separate frontend and backend architecture: React handles the user interface, while FastAPI provides REST API services and MongoDB stores application data.

The frontend is built with React, Vite, and Tailwind CSS. Vite supports a fast local development workflow through its development server, while Tailwind enables utility-based UI styling. The backend uses FastAPI with asynchronous MongoDB access through Motor; Motor provides a coroutine-based interface for non-blocking MongoDB operations.

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Frontend | React | Builds reusable, component-based user interfaces |
| Frontend tooling | Vite | Runs the frontend development server and supports fast updates during development |
| Styling | Tailwind CSS | Applies responsive layouts, colours, spacing, and custom visual styling |
| Frontend state | React Context API | Stores authentication state and makes it available across components |
| Backend | Python and FastAPI | Creates API endpoints, performs validation, and handles authentication |
| Database | MongoDB | Stores user and application data in document format |
| Database driver | Motor | Enables asynchronous communication between FastAPI and MongoDB |
| Authentication | JWT | Allows the backend to issue signed access tokens after successful login |
| Validation | Pydantic | Defines and validates the expected structure of incoming API data |

JWT-based authentication is commonly used as a stateless bearer-token approach, where the frontend sends a token with protected requests and the backend validates it before granting access.

---

# Frontend Implementation

## User Interface and Styling
The frontend implements a custom “Midnight Editorial” visual design intended to create a premium, distraction-free learning environment. The visual identity uses dark backgrounds such as `#13131f`, card surfaces such as `#17171f`, and a primary accent colour of `#5B57FF`.

Tailwind CSS utility classes and custom styling are used to control:
- Responsive layouts for desktop and smaller screens.
- Typography, spacing, borders, shadows, and hover effects.
- Dark-themed backgrounds and elevated card surfaces.
- Interactive buttons, navigation items, dropdowns, and progress indicators.
- Smooth scrolling anchors and dynamic URL parsing for seamless navigation.
- Consistent colours across landing, authentication, dashboard, and study-plan screens.

## Landing Page
The `LandingPage.jsx` component provides the public introduction to ElimuPap.
Implemented sections include:
- A two-column hero section that introduces the system and presents a tablet-style product mock-up.
- A “Precision in Education” feature grid that communicates three central value propositions.
- A three-step workflow section showing how a learner can move through the platform.
- Calls to action that direct visitors toward account registration or login.

This page is designed to give first-time users a clear understanding of the purpose and visual identity of the application before authentication.

## Authentication Pages
The application contains two main authentication components:
- `RegisterPage.jsx`
- `LoginPage.jsx`

The registration page allows new users to create an account. It performs immediate frontend validation before data is submitted to the backend. This reduces avoidable invalid requests and gives users prompt feedback.

The login page allows existing users to enter their credentials. When authentication succeeds, the user receives access to protected sections of the system.

The frontend validates fields such as:
- Required user input.
- Correct email or username format, depending on the implemented form fields.
- Password requirements.
- Matching password confirmation, where included.
- Basic error feedback before the request reaches the API.

## Dashboard
The `DashboardPage.jsx` component acts as the main student hub after login.
Implemented dashboard features include:
- Circular and linear progress bars enhanced with CSS animations.
- A dynamically generated avatar that derives initials from the active user’s details.
- A clickable avatar menu.
- A floating logout dropdown.
- Activity-feed sections.
- Quick-action links to relevant academic areas.
- A "Semester Units" grid that displays registered units and directly routes users to the dedicated unit content page when clicked.
- A layout intended to make student progress and next actions visible at a glance.

The dashboard combines visual feedback and navigation so that authenticated users can quickly understand their current learning status.

## Study Plan
The `StudyPlanPage.jsx` component provides an interactive study-planning interface.
Implemented features include:
- A dual-column vertical timeline.
- Academic milestone tracking.
- A visual sequence of learning tasks or goals.
- A layout that separates different study-plan elements clearly.

The page is intended to help learners organise their academic activities and monitor progress through milestones over time.

## Notes & Unit Management
The `NotesPage.jsx` and `UnitTopicsPage.jsx` manage how users interact with their course material in a highly structured hierarchy.
- **Unit Grid**: The `NotesPage.jsx` acts as a high-level directory, displaying all registered units dynamically based on user data.
- **Topic Navigation**: Clicking a unit opens `UnitTopicsPage.jsx`, providing a dedicated view of all topics within that unit. It automatically generates a "Table of Contents" pill-list at the top of the page, allowing users to smoothly scroll down to specific topics.
- **Smart Uploads**: The `UploadNotesPage.jsx` processes file uploads (such as PDFs and images). When a user clicks to upload notes from a specific topic page, the application uses React Router's `useLocation` to parse URL query parameters (e.g. `?unit=...&topic=...`) and intelligently pre-fills the correct unit and topic in the upload dropdowns.

## AI Tutor & Interactive Testing
The `TutorPage.jsx` provides an intelligent, context-aware conversational interface.
- **Context Badging**: By reading `unit` and `topic` parameters from the URL, the AI Tutor detects what the student is actively studying. It displays a visual "Context Badge" and dynamically adjusts its initial greeting to focus on the active study material.
- **Global Accessibility**: The AI Tutor is accessible directly from the main persistent Sidebar.
- **Test Mode Menu**: An interactive "Test Me" dropdown is integrated directly into the chat input area. This allows users to rapidly populate the chat with commands to generate **Questions**, **Games**, or **Flashcards** based on their uploaded notes.

## Authentication State Management
Authentication state is managed using `AuthContext.jsx`.
Its responsibilities include:
- Storing the current authenticated user.
- Storing and retrieving the JWT access token.
- Coordinating login and logout actions.
- Attaching authentication data to protected API requests.
- Restricting private routes so unauthenticated users cannot access protected pages.
- Redirecting users appropriately after login or logout.

This approach avoids passing user and token data manually through many nested React components.

---

# Backend Implementation

## FastAPI Architecture
The backend is built with FastAPI and Python. FastAPI is used to expose API endpoints for frontend communication, validate incoming data, and return structured responses.

The backend is organised into key areas:
- `main.py` starts the FastAPI application.
- `routers/auth.py` contains authentication-related endpoints.
- `models/user.py` contains Pydantic models and validation logic.
- MongoDB connection logic connects the application to persistent storage.

FastAPI also exposes interactive API documentation at `/docs`, allowing developers to inspect and test available endpoints during development.

## MongoDB Integration
MongoDB is used to store application data, including user records. The backend connects to MongoDB using the Motor asynchronous driver.

Motor allows database calls to be awaited rather than blocking the application while a database operation is in progress. This suits FastAPI’s asynchronous design and supports better responsiveness when handling multiple requests.

Typical stored user data may include:
- User name or full name.
- Email address.
- Hashed password.
- Account creation information.
- Other profile-related fields added in later development stages.

## User Validation
The `models/user.py` file uses Pydantic schemas to define expected input formats.

The backend validates registration information before creating a user account. Password validation includes custom `@field_validator` logic that enforces strong password requirements:
- Minimum of eight characters.
- At least one uppercase letter.
- At least one special character or number.

This validation is important because frontend validation can be bypassed. The backend remains the final authority that ensures data is acceptable before it is stored.

## Registration Endpoint
The registration endpoint in `routers/auth.py` accepts new-user details from the frontend.

The registration process follows these steps:
1. The frontend sends registration data to the backend.
2. Pydantic validates the structure and password requirements.
3. The backend checks whether the user already exists.
4. The password is processed securely before storage.
5. The new user record is saved in MongoDB.
6. A success response is returned to the frontend.

## Login Endpoint and JWT Tokens
The login endpoint receives a user’s credentials and verifies them against stored account details.

The login process follows these steps:
1. The frontend sends login credentials to the backend.
2. The backend locates the user record in MongoDB.
3. The submitted password is verified against the stored hashed password.
4. If the credentials are valid, the backend creates a JWT access token.
5. The token is returned to the frontend.
6. The frontend stores the token through the authentication context.
7. Protected requests include the token so the backend can verify the user’s identity.

FastAPI’s JWT guidance describes signing tokens with a secret key and algorithm, with expiration data used to limit token lifetime.

## Password Security Intervention
A password-handling issue involving bcrypt was identified and addressed. Bcrypt has a 72-byte password input limit. Passwords longer than this can cause processing failures in some implementations.

To prevent registration crashes, passwords exceeding 72 bytes are manually truncated before hashing. This protects the system from fatal errors during registration and ensures that long password input does not crash the backend.

For future improvement, the project should clearly communicate this policy to users and consider a password-hashing approach that handles long inputs without silent truncation.

---

# How to Run ElimuPap Locally

## Prerequisites
Ensure the following are installed before starting the project:
- Node.js and npm.
- Python.
- MongoDB.
- Visual Studio Code.
- A Python virtual environment and required backend packages.
- Frontend dependencies installed through npm.

MongoDB must be running locally before the backend can connect and perform user registration or login operations.

## Open the Project
1. Open Visual Studio Code.
2. Select **File > Open Folder**.
3. Choose the ElimuPap root folder:
   `c:\Users\hp\OneDrive\Desktop\ELIMUPAP`

## Start MongoDB
Start the local MongoDB service before launching the backend.
On Windows, this may be done through the Services application if MongoDB was installed as a service. Alternatively, run MongoDB using the command appropriate to the local installation.

## Start the Backend
1. Open a new VS Code terminal.
2. Move into the backend folder:
   `cd backend`
3. Activate the virtual environment:
   `venv\Scripts\activate`
4. Install backend dependencies if they are not already installed:
   `pip install -r requirements.txt`
5. Start the FastAPI server:
   `uvicorn main:app --reload`
6. Confirm that the backend is available at:
   `http://127.0.0.1:8000`
7. Open the automatic FastAPI API documentation at:
   `http://127.0.0.1:8000/docs`

## Start the Frontend
1. Open a second VS Code terminal.
2. Move into the frontend folder:
   `cd frontend`
3. Install frontend dependencies if necessary:
   `npm install`
4. Start the Vite development server:
   `npm run dev`
5. Open the URL displayed in the terminal, typically:
   `http://localhost:5173`

## Test the System
After both servers are running:
1. Open the frontend URL in a web browser.
2. View the landing page.
3. Register a new user using a password that meets the security requirements.
4. Log in with the created account.
5. Confirm redirection to the dashboard.
6. Test the avatar dropdown and logout process.
7. Open the notes page and register units/topics.
8. Upload a test document via the specific topic.
9. Open the AI Tutor and test the context-aware routing and interactive test menu.
10. Check the backend API documentation at `/docs` to confirm that the authentication endpoints are active.

---

# Current Limitations and Next Improvements

The present version establishes a strong foundation for ElimuPap. Recommended next development tasks include:
- Connect the frontend AI Tutor mock to a live LLM integration (e.g., Gemini or OpenAI).
- Connect study-plan milestones to individual user accounts.
- Add create, edit, delete, and completion actions for study-plan tasks.
- Process actual file metadata natively upon document upload.
- Add token expiry handling and automatic logout.
- Store secrets, database URLs, and JWT configuration in environment variables.
- Add unit tests and API integration tests.
- Add password-reset functionality.
- Improve accessibility through keyboard navigation, labels, and contrast checks.
- Prepare the project for deployment using separate production environment settings.
