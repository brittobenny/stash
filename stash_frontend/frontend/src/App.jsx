import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ShopOwnerDashboard from './pages/ShopOwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Pantry from './pages/Pantry';
import Shop from './pages/Shop';
import Cart from './pages/Cart';
import Profile from './pages/Profile';
import Nutrition from './pages/Nutrition';
import RecipeDetail from './pages/RecipeDetail';
import Orders from './pages/Orders';
import Payment from './pages/Payment';
import Cook from './pages/Cook';
import './styles/global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes (Wrapped in Layout) */}
        <Route element={<Layout />}>
          {/* Default customer route or dashboard if kept */}
          <Route path="customer" element={<Navigate to="/customer/inventory" replace />} />

          {/* New Customer Routes */}
          <Route path="/customer/inventory" element={<Pantry />} />
          <Route path="/customer/cook" element={<Cook />} />
          <Route path="/customer/nutrition" element={<Nutrition />} />
          <Route path="/customer/recipes/:id" element={<RecipeDetail />} />
          <Route path="/customer/shop" element={<Shop />} />
          <Route path="/customer/cart" element={<Cart />} />
          <Route path="/customer/account" element={<Profile />} />
          <Route path="/customer/orders" element={<Orders />} />
          <Route path="/customer/payment/:id" element={<Payment />} />

          <Route path="shop-owner" element={<ShopOwnerDashboard />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
