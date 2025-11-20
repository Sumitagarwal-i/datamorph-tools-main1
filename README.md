# 🚀 DataMorph - Fast Data Conversion Tool

Transform your data instantly between CSV, JSON and more formats. Fast, secure, and completely free.

## ✨ Features

- **🎯 Smart Auto-Detection**: Automatically detects CSV or JSON format
- **⚡ Lightning Fast**: Instant conversions in your browser
- **🔒 100% Private**: All processing happens locally - your data never leaves your device
- **🎨 JSON Beautifier & Validator**: Format, validate, and minify JSON
- **📂 Drag & Drop Support**: Simply drag files to convert
- **💾 Easy Export**: Copy to clipboard or download results
- **🌙 Dark Mode**: Beautiful UI with dark mode support
- **🔧 Advanced Features**: Handles nested objects, arrays, missing keys, and special characters

## 🌐 Project Info

**URL**: https://lovable.dev/projects/14e1d938-014b-4a17-9140-945e5c71f715

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/14e1d938-014b-4a17-9140-945e5c71f715) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## 🛠️ Tech Stack

- **Vite** - Lightning-fast build tool
- **TypeScript** - Type-safe development
- **React** - UI framework
- **shadcn-ui** - Beautiful component library
- **Tailwind CSS** - Utility-first styling
- **PapaParse** - Powerful CSV parser
- **Supabase** - Backend for analytics (optional)

## 📦 Installation & Setup

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd datamorph-tools-main
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## 🚀 Deploy to Vercel

### Quick Deploy (Recommended)

1. Push your code to GitHub
2. Visit [Vercel](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Vite settings
6. Click "Deploy"

Your app will be live in ~2 minutes!

### Environment Variables (Optional)

If you want analytics via Supabase:
- Add `VITE_SUPABASE_URL` with your Supabase project URL
- Add `VITE_SUPABASE_ANON_KEY` with your Supabase anon key

## 🎯 Usage

### CSV to JSON
1. Paste CSV data or drag & drop a CSV file
2. Click "Convert"
3. Copy or download the JSON output

### JSON to CSV
1. Paste JSON array or drag & drop a JSON file
2. Click "Convert"
3. Copy or download the CSV output

### Auto-Detect
1. Paste any CSV or JSON data
2. The tool automatically detects the format
3. Click "Auto Convert" for instant conversion

### JSON Tools
- **Beautify**: Format JSON with proper indentation
- **Minify**: Remove whitespace for compact JSON
- **Validate**: Check if JSON is valid

## 📊 Supabase Setup (Optional Analytics)

Your Supabase database is already configured! The `conversions` table tracks:
- Input format (CSV/JSON)
- Output format (CSV/JSON)
- Item count
- Timestamp

**To verify it's working:**
1. Go to your Supabase project dashboard
2. Navigate to Table Editor
3. Check the `conversions` table
4. Make a conversion in the app
5. Refresh the table to see the logged conversion

## 🌟 Unique Features

1. **Smart Auto-Detection**: No need to specify format - paste and convert
2. **Drag & Drop**: Easiest way to upload files
3. **JSON Beautifier**: Built-in JSON formatter and validator
4. **Privacy First**: All processing happens in your browser
5. **No Login Required**: Start using immediately
6. **Offline Ready**: Works without internet connection

## 📈 Next Steps

1. ✅ Core functionality complete
2. ✅ Supabase logging enabled
3. ✅ UI polished with animations
4. ✅ Landing page added
5. ✅ Unique features implemented
6. 🎯 **NEXT**: Deploy to Vercel
7. 🎯 **NEXT**: Share on ProductHunt, Reddit, Twitter
8. 🎯 **NEXT**: Add more converters (XML, YAML, etc.)

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

MIT License - feel free to use this project for anything!

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/14e1d938-014b-4a17-9140-945e5c71f715) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
