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
        if (config.data instanceof FormData) {
            // Let the browser set the correct multipart boundary
            delete config.headers['Content-Type'];
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
            localStorage.removeItem('user');
            const path = window.location.pathname;
            if (path !== '/login' && path !== '/register') {
                window.location.assign('/login');
            }
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

export const accountService = {
    getProfile: () => api.get('/accounts/profile/'),
    updateProfile: (payload) => {
        const formData = new FormData();
        if (payload && typeof payload === 'object') {
            Object.entries(payload).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, value);
                }
            });
        }
        return api.patch('/accounts/profile/', formData);
    },
    getNotifications: (params = {}) => api.get('/accounts/notifications/', { params }),
    markNotificationRead: (id) => api.post(`/accounts/notifications/${id}/`),
    markAllNotificationsRead: () => api.post('/accounts/notifications/all/'),
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

export const nutritionService = {
    getProfileSummary: () => api.get('/nutrition/profile/'),
    getDailyScores: (params = {}) => api.get('/nutrition/daily/', { params }),
    getWeeklyScores: (params = {}) => api.get('/nutrition/weekly/', { params }),
    getRewards: (params = {}) => api.get('/nutrition/rewards/', { params }),
    getCookedHistory: (params = {}) => api.get('/nutrition/cooked/', { params }),
    recalculate: (date = null) => api.post('/nutrition/recalculate/', date ? { date } : {}),
};

export const recipeService = {
    getRecommendations: (ingredients = null, options = {}) => {
        const top_k = Math.min(10, Math.max(1, Number(options.top_k || 10)));
        const min_match_percent = Number(options.min_match_percent ?? 25);
        if (Array.isArray(ingredients) && ingredients.length > 0) {
            return api.post('/recommend/', { ingredients, top_k, min_match_percent });
        }
        return api.get('/recommend/', { params: { top_k, min_match_percent } });
    },
    getRecipeDetail: (recipeId, scale = 1) => {
        const params = scale && scale !== 1 ? { scale } : {};
        return api.get(`/recipes/${recipeId}/`, { params });
    },
    translateSteps: (steps = [], target_lang = 'ml', source_lang = 'en') =>
        api.post('/translate-steps/', { steps, target_lang, source_lang }),
    fetchStepTts: (text, lang = 'ml') =>
        api.get('/step-tts/', {
            params: { text, lang },
            responseType: 'blob',
        }),
    cookRecipe: (recipeId, allowPartial = false, ingredients = null, scale = 1) =>
        api.post('/cook/', { recipe_id: recipeId, allow_partial: allowPartial, ingredients, scale }),
};

export const shopService = {
    getProducts: () => api.get('/shop/products/'),
    addToCart: (productId, quantity) => api.post('/shop/cart/add/', { product_id: productId, quantity }),
    updateCartItem: (itemId, quantity) => api.post(`/shop/cart/item/${itemId}/`, { quantity }),
    getCart: () => api.get('/shop/cart/'),
    checkout: () => api.post('/shop/checkout/'),
    listOrders: (params = {}) => api.get('/shop/orders/', { params }),
    markDelivered: (orderId) => api.post(`/shop/orders/${orderId}/delivered/`),
    cancelOrder: (orderId) => api.post(`/shop/orders/${orderId}/cancel/`),
    confirmAddToPantry: (orderId, addToPantry = true) =>
        api.post(`/shop/orders/${orderId}/confirm-pantry/`, { add_to_pantry: addToPantry }),
};

export const shopOwnerService = {
    addProduct: (product) => api.post('/shop/products/add/', product),
    getMyProducts: (params = {}) => api.get('/shop/products/my/', { params }),
    updateProduct: (id, product) => api.put(`/shop/products/update/${id}/`, product),
    deleteProduct: (id) => api.delete(`/shop/products/delete/${id}/`),
    listCategories: () => api.get('/shop/categories/'),
    createCategory: (name, imageFile = null) => {
        const formData = new FormData();
        formData.append('name', name);
        if (imageFile) {
            formData.append('image', imageFile);
        }
        return api.post('/shop/categories/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    listOrders: (params = {}) => api.get('/shop/owner/orders/', { params }),
    updateOrderStatus: (orderId, status) => api.post(`/shop/owner/orders/${orderId}/status/`, { status }),
    getAnalytics: (params = {}) => api.get('/shop/owner/analytics/', { params }),
    exportAnalytics: (params = {}) => api.get('/shop/owner/analytics/export/', { params, responseType: 'blob' }),
};

export const adminService = {
    getSummary: () => api.get('/accounts/admin/summary/'),
    listUsers: () => api.get('/accounts/admin/users/'),
    listShops: () => api.get('/accounts/admin/users/?role=shopowner'),
    listOrders: (params = {}) => api.get('/shop/admin/orders/', { params }),
};

export const socialService = {
    getFeed: (params = {}) => api.get('/social/feed/', { params }),
    getMyPosts: () => api.get('/social/mine/'),
    getPost: (postId) => api.get(`/social/posts/${postId}/`),
    createPost: (payload) => {
        const formData = new FormData();
        if (payload && typeof payload === 'object') {
            Object.entries(payload).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, value);
                }
            });
        }
        return api.post('/social/posts/', formData);
    },
    updatePost: (postId, payload) => {
        const formData = new FormData();
        if (payload && typeof payload === 'object') {
            Object.entries(payload).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, value);
                }
            });
        }
        return api.patch(`/social/posts/${postId}/`, formData);
    },
    deletePost: (postId) => api.delete(`/social/posts/${postId}/`),
    likePost: (postId) => api.post(`/social/posts/${postId}/like/`),
    unlikePost: (postId) => api.delete(`/social/posts/${postId}/like/`),
    listComments: (postId) => api.get(`/social/posts/${postId}/comments/`),
    addComment: (postId, text) => api.post(`/social/posts/${postId}/comments/`, { text }),
    approvePost: (postId) => api.post(`/social/posts/${postId}/approve/`),
    rejectPost: (postId, reason = '') => api.post(`/social/posts/${postId}/reject/`, { reason }),
    getReviewQueue: (status = 'ALL') => api.get('/social/review/', { params: { status } }),
};

export default api;
