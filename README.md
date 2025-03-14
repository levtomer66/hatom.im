# Dog Family Tree Visualization

A Next.js application for visualizing and managing a family tree of dog names. This application allows users to view, add, edit, and remove names from a family tree structure, with a dog-themed UI suitable for printing on a poster.

## Features

- Interactive horizontal family tree visualization
- Dog-themed card design for each family member
- Add new members as children or siblings
- Edit names by double-clicking on them
- Remove members and their descendants
- Save changes to MongoDB database
- Responsive design suitable for printing on a poster

## Technologies Used

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS for styling
- React D3 Tree for tree visualization
- MongoDB for data storage
- React Icons for UI icons

## Getting Started

### Prerequisites

- Node.js 18 or later
- MongoDB instance (local or remote)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd hatom-family-tree
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file in the root directory with your MongoDB connection string:
   ```
   MONGODB_URI=mongodb://localhost:27017/family-tree
   ```

4. Run the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Seeding the Database

To initialize the database with the default family tree data, visit:
```
http://localhost:3000/api/seed
```

## Usage

- **View the Family Tree**: The family tree is displayed horizontally with the root member on the left.
- **Edit a Name**: Double-click on any name to edit it.
- **Add a Child**: Click the green "+" button on a card to add a child to that member.
- **Add a Sibling**: Click the blue "+" button on a card to add a sibling to that member.
- **Remove a Member**: Click the red trash button to remove a member and all their descendants.
- **Save Changes**: Click the "Save Family" button at the top to save all changes to the database.

## Printing

The application is designed to be printed as a poster. Use your browser's print functionality (Ctrl+P or Cmd+P) and select landscape orientation for best results.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 