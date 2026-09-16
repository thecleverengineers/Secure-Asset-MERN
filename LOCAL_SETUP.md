# Local Setup — No Docker

## Windows

1. Install Node.js 20+.
2. Install MongoDB Community Server as a service, or create MongoDB Atlas access.
3. Extract the project ZIP.
4. Open Command Prompt or PowerShell in the project folder.
5. Run:

```powershell
npm.cmd run setup:local
npm.cmd install
npm.cmd run db:check
npm.cmd run seed
npm.cmd run migrate:document-vault
npm.cmd run migrate:advanced-rental
npm.cmd run db:indexes
npm.cmd run dev
```

Open `http://localhost:5173`.

## Existing database

Back up the database first:

```powershell
npm.cmd ci
npm.cmd run db:check
npm.cmd run migrate:tenant-landlord
npm.cmd run migrate:surveyor-subscription
npm.cmd run migrate:document-vault
npm.cmd run migrate:advanced-rental
npm.cmd run db:indexes
npm.cmd run dev
```

Do not run `seed` against existing production data.

## MongoDB Atlas

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/secureasset?retryWrites=true&w=majority
```

Allow the server IP in Atlas Network Access and URL-encode special password characters.

## Admin CMS

Sign in with an Admin account and open **Site & Marketplace Administration**. The page manages:

- Site title, logo, favicon, colours and contact details
- SEO defaults and route SEO
- Homepage carousel and sections
- Map provider and public API key
- Property types and dynamic form fields
- Regional area units/conversions
- Landlord plans and structural limits

Changes are loaded from MongoDB by the public site and do not require another build.

## Common errors

### `npm.ps1 cannot be loaded`

Use:

```powershell
npm.cmd install
npm.cmd run dev
```

### MongoDB `ECONNREFUSED`

Start the Windows MongoDB service:

```bat
net start MongoDB
```

### Dynamic property fields do not appear

Run:

```powershell
npm.cmd run migrate:advanced-rental
```

Then confirm the property type is Active and its `fields` JSON is valid in Admin.

### Public property is missing

Confirm:

- The owner has an active Landlord Subscription.
- The property or space is Public and Published.
- Its status is Available or Partially Occupied where supported.
- The plan public-listing limit is not exceeded.

## Production

See `PRODUCTION_DEPLOYMENT.md`.
