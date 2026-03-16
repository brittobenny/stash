import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import ShopOwnerDashboard from './pages/ShopOwnerDashboard';
import ShopOwnerProducts from './pages/ShopOwnerProducts';
import ShopOwnerOrders from './pages/ShopOwnerOrders';
import ShopOwnerFeedback from './pages/ShopOwnerFeedback';
import ShopOwnerInventory from './pages/ShopOwnerInventory';
import ShopOwnerOrderDetail from './pages/ShopOwnerOrderDetail';
import ShopOwnerSettings from './pages/ShopOwnerSettings';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminShops from './pages/AdminShops';
import AdminPosts from './pages/AdminPosts';
import AdminOrders from './pages/AdminOrders';
import AdminFeedback from './pages/AdminFeedback';
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
import Notifications from './pages/Notifications';
import SocialHome from './pages/SocialHome';
import SocialRecipeDetail from './pages/SocialRecipeDetail';
import RolePreloader from './pages/RolePreloader';
import './styles/global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/loading" element={<RolePreloader />} />

        {/* Protected Routes (Wrapped in Layout) */}
        <Route element={<Layout />}>
          <Route element={<RequireAuth allowedRoles={['customer']} />}>
            <Route path="customer" element={<Navigate to="/customer/home" replace />} />
            <Route path="/customer/home" element={<SocialHome />} />
            <Route path="/customer/community/:id" element={<SocialRecipeDetail />} />
            <Route path="/customer/inventory" element={<Pantry />} />
            <Route path="/customer/cook" element={<Cook />} />
            <Route path="/customer/nutrition" element={<Nutrition />} />
            <Route path="/customer/recipes/:id" element={<RecipeDetail />} />
            <Route path="/customer/shop" element={<Shop />} />
            <Route path="/customer/cart" element={<Cart />} />
            <Route path="/customer/account" element={<Profile />} />
            <Route path="/customer/notifications" element={<Notifications />} />
            <Route path="/customer/orders" element={<Orders />} />
            <Route path="/customer/payment/:id" element={<Payment />} />
          </Route>

          <Route element={<RequireAuth allowedRoles={['shopowner']} />}>
            <Route path="shop-owner" element={<Navigate to="/shop-owner/dashboard" replace />} />
            <Route path="shop-owner/dashboard" element={<ShopOwnerDashboard />} />
            <Route path="shop-owner/inventory" element={<ShopOwnerInventory />} />
            <Route path="shop-owner/products" element={<ShopOwnerProducts />} />
            <Route path="shop-owner/orders" element={<ShopOwnerOrders />} />
            <Route path="shop-owner/orders/:id" element={<ShopOwnerOrderDetail />} />
            <Route path="shop-owner/feedback" element={<ShopOwnerFeedback />} />
            <Route path="shop-owner/settings" element={<ShopOwnerSettings />} />
          </Route>

          <Route element={<RequireAuth allowedRoles={['admin']} />}>
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/shops" element={<AdminShops />} />
            <Route path="admin/posts" element={<AdminPosts />} />
            <Route path="admin/orders" element={<AdminOrders />} />
            <Route path="admin/feedback" element={<AdminFeedback />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
