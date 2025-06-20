const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

// Get landing page content
router.get('/landing', async (req, res) => {
  try {
    const { lang = 'en' } = req.query;

    const { data: content, error } = await supabase
      .from('content_pages')
      .select('content')
      .eq('type', 'landing')
      .eq('lang', lang)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Get landing content error:', error);
      return res.status(500).json({ message: 'Failed to fetch content' });
    }

    if (!content) {
      // Return default content
      const defaultContent = getDefaultLandingContent(lang);
      return res.json(defaultContent);
    }

    res.json(content.content);
  } catch (error) {
    console.error('Get landing content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get pricing page content
router.get('/pricing', async (req, res) => {
  try {
    const { lang = 'en' } = req.query;

    const { data: content, error } = await supabase
      .from('content_pages')
      .select('content')
      .eq('type', 'pricing')
      .eq('lang', lang)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Get pricing content error:', error);
      return res.status(500).json({ message: 'Failed to fetch content' });
    }

    if (!content) {
      // Return default content
      const defaultContent = getDefaultPricingContent(lang);
      return res.json(defaultContent);
    }

    res.json(content.content);
  } catch (error) {
    console.error('Get pricing content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

function getDefaultLandingContent(lang) {
  return {
    hero: {
      title: lang === 'id' ? 'Layanan Tunneling Aman & Cepat' : 'Secure & Fast Tunneling Service',
      subtitle: lang === 'id' 
        ? 'Hubungkan aplikasi lokal Anda ke internet dengan layanan tunneling yang handal. Mulai dalam hitungan menit.'
        : 'Connect your local applications to the internet with our reliable tunneling service. Get started in minutes.',
      cta_primary: lang === 'id' ? 'Mulai Sekarang' : 'Get Started',
      cta_secondary: lang === 'id' ? 'Pelajari Lebih Lanjut' : 'Learn More',
    },
    features: [
      {
        icon: 'Shield',
        title: lang === 'id' ? 'Koneksi Aman' : 'Secure Connection',
        description: lang === 'id' ? 'Enkripsi end-to-end untuk semua koneksi Anda' : 'End-to-end encryption for all your connections',
      },
      {
        icon: 'Zap',
        title: lang === 'id' ? 'Sangat Cepat' : 'Lightning Fast',
        description: lang === 'id' ? 'Server yang dioptimalkan di seluruh dunia untuk latensi minimal' : 'Optimized servers worldwide for minimal latency',
      },
      {
        icon: 'Globe',
        title: lang === 'id' ? 'Layanan Handal' : 'Reliable Service',
        description: lang === 'id' ? 'Jaminan uptime 99.9% dengan monitoring 24/7' : '99.9% uptime guarantee with 24/7 monitoring',
      },
    ],
    stats: [
      { number: '99.9%', label: 'Uptime' },
      { number: '50+', label: lang === 'id' ? 'Negara' : 'Countries' },
      { number: '24/7', label: lang === 'id' ? 'Dukungan' : 'Support' },
      { number: '1M+', label: lang === 'id' ? 'Pengguna' : 'Users' },
    ],
    testimonials: [
      {
        name: 'John Doe',
        role: 'Developer',
        content: lang === 'id' 
          ? 'Tunlify telah mengubah alur kerja pengembangan kami.'
          : 'Tunlify has been a game-changer for our development workflow.',
        rating: 5,
      },
      {
        name: 'Jane Smith',
        role: 'DevOps Engineer',
        content: lang === 'id'
          ? 'Handal, cepat, dan aman. Semua yang kami butuhkan dalam layanan tunneling.'
          : 'Reliable, fast, and secure. Everything we need in a tunneling service.',
        rating: 5,
      },
    ],
  };
}

function getDefaultPricingContent(lang) {
  return {
    title: lang === 'id' ? 'Pilih Paket yang Tepat' : 'Choose the Right Plan',
    subtitle: lang === 'id' 
      ? 'Mulai gratis, upgrade kapan saja sesuai kebutuhan Anda.'
      : 'Start free, upgrade anytime as your needs grow.',
    plans: [
      {
        id: 'free',
        name: lang === 'id' ? 'Gratis' : 'Free',
        price: 0,
        period: lang === 'id' ? '/bulan' : '/month',
        description: lang === 'id' ? 'Sempurna untuk memulai' : 'Perfect for getting started',
        features: [
          lang === 'id' ? '1 tunnel aktif' : '1 active tunnel',
          lang === 'id' ? 'Bandwidth 1GB/bulan' : '1GB bandwidth/month',
          lang === 'id' ? 'Subdomain gratis' : 'Free subdomain',
          lang === 'id' ? 'Dukungan email' : 'Email support',
        ],
        popular: false,
        cta: lang === 'id' ? 'Mulai Gratis' : 'Start Free',
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 10,
        period: lang === 'id' ? '/bulan' : '/month',
        description: lang === 'id' ? 'Untuk developer professional' : 'For professional developers',
        features: [
          lang === 'id' ? '5 tunnel aktif' : '5 active tunnels',
          lang === 'id' ? 'Bandwidth 50GB/bulan' : '50GB bandwidth/month',
          lang === 'id' ? 'Custom domain' : 'Custom domain',
          lang === 'id' ? 'SSL gratis' : 'Free SSL',
          lang === 'id' ? 'Prioritas dukungan' : 'Priority support',
          lang === 'id' ? 'Analitik lanjutan' : 'Advanced analytics',
        ],
        popular: true,
        cta: lang === 'id' ? 'Pilih Pro' : 'Choose Pro',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 50,
        period: lang === 'id' ? '/bulan' : '/month',
        description: lang === 'id' ? 'Untuk tim dan perusahaan' : 'For teams and companies',
        features: [
          lang === 'id' ? 'Tunnel unlimited' : 'Unlimited tunnels',
          lang === 'id' ? 'Bandwidth unlimited' : 'Unlimited bandwidth',
          lang === 'id' ? 'Multiple custom domain' : 'Multiple custom domains',
          lang === 'id' ? 'Dukungan 24/7' : '24/7 support',
          lang === 'id' ? 'SLA 99.9%' : '99.9% SLA',
          lang === 'id' ? 'Manajemen tim' : 'Team management',
          lang === 'id' ? 'API akses' : 'API access',
        ],
        popular: false,
        cta: lang === 'id' ? 'Hubungi Sales' : 'Contact Sales',
      },
    ],
  };
}

module.exports = router;