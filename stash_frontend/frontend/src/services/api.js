import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Uses Vite proxy
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to inject the token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Token ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401s (optional)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            // distinct from window.location.href to avoid full reload loops if not careful, 
            // but for now simple redirect is okay or let comp handle it
        }
        return Promise.reject(error);
    }
);

export const authService = {
    login: async (username, password) => {
        const response = await api.post('/accounts/login/', { email: username, password });
        // Expected response: { token: '...', user_id: 1, email: '...', role: 'customer' } 
        // Note: Backend might need to return role. If not, we might need a separate profile fetch.
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            // Assuming backend returns role, otherwise we default or fetch profile
            // For now, let's assume we fetch profile next if role isn't in login response
            // But user said "check roles and redirect" implying logic is needed.
        }
        return response.data;
    },
    register: async (userData) => {
        const response = await api.post('/accounts/register/', userData);
        return response.data;
    },
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
    }
};

export const pantryService = {
    getItems: () => api.get('/pantry/'),
    addItem: (item) => api.post('/pantry/add/', item),
    listIngredients: () => api.get('/ingredients/'),
    updateItem: (id, payload) => api.patch(`/pantry/update/${id}/`, payload),
};

export const inventoryService = {
    listUsage: () => api.get('/inventory/'),
};

export const recipeService = {
    getRecommendations: (ingredients = null) => {
        if (Array.isArray(ingredients) && ingredients.length > 0) {
            return api.post('/recommend/', { ingredients });
        }
        return api.get('/recommend/');
    },
    getRecipeDetail: (recipeId) => api.get(`/recipes/${recipeId}/`),
    cookRecipe: (recipeId, allowPartial = false, ingredients = null) =>
        api.post('/cook/', { recipe_id: recipeId, allow_partial: allowPartial, ingredients }),
};

export const shopService = {
    getProducts: () => api.get('/shop/products/'),
    addToCart: (productId, quantity) => api.post('/shop/cart/add/', { product_id: productId, quantity }),
    updateCartItem: (itemId, quantity) => api.post(`/shop/cart/item/${itemId}/`, { quantity }),
    getCart: () => api.get('/shop/cart/'),
    checkout: () => api.post('/shop/checkout/'),
    listOrders: () => api.get('/shop/orders/'),
    markDelivered: (orderId) => api.post(`/shop/orders/${orderId}/delivered/`),
    confirmAddToPantry: (orderId, addToPantry = true) =>
        api.post(`/shop/orders/${orderId}/confirm-pantry/`, { add_to_pantry: addToPantry }),
};

export const shopOwnerService = {
    addProduct: (product) => api.post('/shop/products/add/', product),
    getMyProducts: () => api.get('/shop/products/my/'),
    updateProduct: (id, product) => api.put(`/shop/products/update/${id}/`, product),
    deleteProduct: (id) => api.delete(`/shop/products/delete/${id}/`),
    listCategories: () => api.get('/shop/categories/'),
    createCategory: (name) => api.post('/shop/categories/', { name }),
};

export const adminService = {
    // Note: The backend endpoints for orders seem to be under /api/shop/orders/ or similar.
    // Based on shop/urls.py: path("orders/<int:order_id>/delivered/", mark_delivered)
    // We haven't built a "list all orders" endpoint in the snippets seen, 
    // but assuming there might be one or we use what we have.
    // For now, let's assume we can fetch orders (maybe reuse a shop endpoint or valid admin endpoint if it exists)
    // If not, we'll mock the fetch but use real actions for status.
    // Actually, let's check if there is an endpoint for listing orders. 
    // shop/views.py isn't visible but urls.py shows checkout, cancel, delivered.
    // We'll add the actions we know exist.
    markDelivered: (orderId) => api.post(`/shop/orders/${orderId}/delivered/`),
    cancelOrder: (orderId) => api.post(`/shop/orders/${orderId}/cancel/`),
};

export default api;
