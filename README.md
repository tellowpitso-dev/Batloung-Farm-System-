# Batloung Farm Distribution System

Web application for **Batloung Farm Distribution**, located in Maseru, Lesotho. The business imports fresh fruits in bulk from South African provinces and sells them to street vendors and local shops across Maseru.

The application manages stock by three packaging sizes (small, medium, and large), records purchases from suppliers, manages sales and vendor orders, calculates travel distances and delivery times on a live map, and tracks vendor payments and balances.

---

## Folder Structure

```text
Batloung_Farm_Distribution_Source (3)/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js       # Admin and vendor sign in logic
│   │   │   ├── fruitController.js      # Fruit catalogue and packaging sizes
│   │   │   ├── purchaseController.js   # Supplier stock purchases
│   │   │   ├── reportController.js     # Sales reports and analytics
│   │   │   ├── salesController.js      # Customer sales and order handling
│   │   │   ├── supplierController.js   # South African supplier management
│   │   │   └── vendorController.js     # Vendor registration and balance checks
│   │   ├── database/
│   │   │   ├── db.js                   # MySQL database connection pool
│   │   │   └── schema.sql              # Database tables and sample data for MySQL Workbench
│   │   ├── middleware/
│   │   │   └── auth.js                 # Login token security verification
│   │   ├── models/
│   │   │   ├── fruitModel.js           # Fruit database queries
│   │   │   ├── purchaseModel.js        # Purchase database queries
│   │   │   ├── reportModel.js          # Analytical report queries
│   │   │   ├── salesModel.js           # Sales database queries
│   │   │   ├── supplierModel.js        # Supplier database queries
│   │   │   └── vendorModel.js          # Vendor database queries
│   │   ├── routes/
│   │   │   └── api.js                  # Application API endpoints
│   │   └── server.js                   # Main server file
│   ├── .env                            # Database connection settings
│   ├── package.json                    # Backend packages list
│   └── server.js                       # Server runner file
├── frontend/
│   ├── src/
│   │   ├── css/
│   │   │   └── style.css               # Clean styling without emojis
│   │   └── js/
│   │       └── app.js                  # Frontend logic and live interactive map
│   ├── css/
│   │   └── style.css                   # Main style file
│   ├── js/
│   │   └── app.js                      # Main application script
│   └── index.html                      # Web interface with sign in for admin and vendors
├── package.json                        # Main project configuration
└── README.md                           # System instructions
```

---

## Requirements

1. **MySQL Workbench** (or MySQL Server 8.0 or newer)
2. **Node.js** (version 16 or newer)
3. **Visual Studio Code** or **Visual Studio**
4. A web browser such as Chrome or Edge

---

## Step 1: Set Up the Database in MySQL Workbench

1. Open **MySQL Workbench**.
2. Connect to your local MySQL database (default username is `root`).
3. Click on **File -> Open SQL Script...**
4. Select the file:
   `backend/database/schema.sql`
5. Click the yellow lightning bolt icon (Execute) to run the script.
6. The script creates the database named `batloung_farm_db` and fills it with all the required tables and sample data.
7. Check the file `backend/.env` to confirm the settings match your local MySQL password:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=itsyobouyT06
   DB_NAME=batloung_farm_db
   DB_PORT=3306
   ```

---

## Step 2: Start the Backend Server

1. Open the project folder in **Visual Studio Code** or **Visual Studio**.
2. Open a new terminal window inside the editor.
3. Move into the backend folder and install the dependencies:
   ```bash
   cd backend
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
   You will see a message confirming the server is running on port 5000.

---

## Step 3: Open the Website in Your Browser

Open your web browser and go to:
```text
http://localhost:5000
```

> **Note:** Open `http://localhost:5000` directly. You do not need to add `/api` to the address. The website loads immediately on `http://localhost:5000`.

---

## User Login Details

The website has a sign in form for both administrators and vendors. You can use these demonstration accounts:

| User Type | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@batloung.farm` | `Admin@123` | Full access: manage suppliers, view and update fruit stock, confirm pending orders, change order status, record purchases, and view business reports. |
| **Vendor** | `lerato@vendor.ls` | `Vendor@123` | Vendor portal: view fruit packaging prices, place fruit orders, check order progress, and track deliveries on the live map. |

---

## Core System Features

1. **Packaging Size Inventory**:
   Fruit stock is tracked individually for small, medium, and large packaging sizes. Each size has its own wholesale cost and selling price.

2. **Order Stock Validation**:
   When an order is submitted, the system checks whether enough boxes are available in the warehouse. If a vendor requests more boxes than are in stock, the entire sale is rejected immediately and no stock is deducted.

3. **Order Status Workflow**:
   New orders from vendors start with the status `pending`. Once reviewed by the administrator, the status can be updated to `confirmed`, `out_for_delivery`, or `ready_for_collection`.

4. **Live Map and Delivery Route Tracing**:
   The live map shows the central depot in Maseru and the delivery points of vendors across Maseru. It computes the road distance in kilometers and the estimated travel time in minutes.

5. **Business Reports**:
   The administrator dashboard includes four clear reports:
   - Top 5 most frequently sold fruits.
   - Total sales revenue generated within any selected date range.
   - The top vendor by total box volume purchased.
   - Current stock levels for all fruits by packaging size, with alerts when stock drops below 20 boxes.
