(() => {
  const pathname = window.location.pathname.toLowerCase();
  const dataset = document.documentElement.dataset || {};
  const market = dataset.market || (pathname.startsWith('/us/') ? 'us' : 'mx');
  const locale = dataset.locale || (market === 'us' ? 'en-US' : 'es-MX');

  const productsByMarket = {
    mx: {
      nfc: {
        productId: 'prod_UuyXhL5QkSZkRJ',
        priceId: 'price_1Tv8aVE9Iq6fzuQIrnSLA26U',
        unitPrice: 520,
        quantityMode: 'manual'
      },
      nfc_metalica: {
        productId: 'prod_UuyZSsgUWN0n2r',
        priceId: 'price_1Tv8cjE9Iq6fzuQImmCpQDVC',
        unitPrice: 850,
        quantityMode: 'manual'
      },
      google_reviews: {
        productId: 'prod_UuycU9tgMrzSL8',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv8fRE9Iq6fzuQIeLlp1AEP', totalPrice: 420, unitPrice: 420, quantity: 1 },
          doble: { priceId: 'price_1Tv8nbE9Iq6fzuQIRR2g8MJC', totalPrice: 640, unitPrice: 320, quantity: 2 },
          paquete: { priceId: 'price_1Tv8nbE9Iq6fzuQIKDjj9BEG', totalPrice: 1250, unitPrice: 250, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv8nbE9Iq6fzuQIPHpTe5Fs', totalPrice: 2200, unitPrice: 220, quantity: 10 }
        }
      },
      instagram: {
        productId: 'prod_Uuym0smGzmhmMU',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv8oZE9Iq6fzuQIVFkJLzt4', totalPrice: 420, unitPrice: 420, quantity: 1 },
          doble: { priceId: 'price_1Tv8pfE9Iq6fzuQIp2KKni8h', totalPrice: 640, unitPrice: 320, quantity: 2 },
          paquete: { priceId: 'price_1Tv8pfE9Iq6fzuQICX9128t0', totalPrice: 1250, unitPrice: 250, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv8pfE9Iq6fzuQIM1YbsB6N', totalPrice: 2200, unitPrice: 220, quantity: 10 }
        }
      },
      facebook: {
        productId: 'prod_UuyrOo4m4obgIn',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv8u3E9Iq6fzuQI0CVCM67A', totalPrice: 420, unitPrice: 420, quantity: 1 },
          doble: { priceId: 'price_1Tv8vEE9Iq6fzuQIEi0Nbatp', totalPrice: 640, unitPrice: 320, quantity: 2 },
          paquete: { priceId: 'price_1Tv8vEE9Iq6fzuQIWKieXjgM', totalPrice: 1250, unitPrice: 250, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv8vEE9Iq6fzuQIJ63X9Ws9', totalPrice: 2200, unitPrice: 220, quantity: 10 }
        }
      },
      tripadvisor: {
        productId: 'prod_UuyuzeTlZF00Qc',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv8wFE9Iq6fzuQIT2IjZscx', totalPrice: 420, unitPrice: 420, quantity: 1 },
          doble: { priceId: 'price_1Tv8xEE9Iq6fzuQI6QKpZGF0', totalPrice: 640, unitPrice: 320, quantity: 2 },
          paquete: { priceId: 'price_1Tv8xEE9Iq6fzuQIrdHlzYPV', totalPrice: 1250, unitPrice: 250, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv8xEE9Iq6fzuQIdkhLKYH9', totalPrice: 2200, unitPrice: 220, quantity: 10 }
        }
      }
    },
    us: {
      nfc: {
        productId: 'prod_UuzQf85msB47Bj',
        priceId: 'price_1Tv9RhE9Iq6fzuQISRcT7yKM',
        unitPrice: 29.99,
        quantityMode: 'manual'
      },
      nfc_metalica: {
        productId: 'prod_UuzTvMZDTC8Nxk',
        priceId: 'price_1Tv9UeE9Iq6fzuQILhFX58f2',
        unitPrice: 49.99,
        quantityMode: 'manual'
      },
      google_reviews: {
        productId: 'prod_UuzdpJxHUziUpY',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv9eVE9Iq6fzuQIKkZtocFw', totalPrice: 23.99, unitPrice: 23.99, quantity: 1 },
          doble: { priceId: 'price_1Tv9gxE9Iq6fzuQI2ubobZ2t', totalPrice: 36.56, unitPrice: 18.28, quantity: 2 },
          paquete: { priceId: 'price_1Tv9gxE9Iq6fzuQIZyLG9i58', totalPrice: 71.4, unitPrice: 14.28, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv9gxE9Iq6fzuQIlan5WVaq', totalPrice: 125.66, unitPrice: 12.57, quantity: 10 }
        }
      },
      instagram: {
        productId: 'prod_UuzkQabA8Lm91F',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv9lTE9Iq6fzuQIwium9ZhC', totalPrice: 23.99, unitPrice: 23.99, quantity: 1 },
          doble: { priceId: 'price_1Tv9nbE9Iq6fzuQIrjXzVPD0', totalPrice: 36.56, unitPrice: 18.28, quantity: 2 },
          paquete: { priceId: 'price_1Tv9nbE9Iq6fzuQItuSYdNtP', totalPrice: 71.4, unitPrice: 14.28, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv9nbE9Iq6fzuQIcxk00fnl', totalPrice: 125.66, unitPrice: 12.57, quantity: 10 }
        }
      },
      facebook: {
        productId: 'prod_UuzofGeuoBOXox',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv9ofE9Iq6fzuQIHBQKU8zL', totalPrice: 23.99, unitPrice: 23.99, quantity: 1 },
          doble: { priceId: 'price_1Tv9plE9Iq6fzuQIt0gjf7Im', totalPrice: 36.56, unitPrice: 18.28, quantity: 2 },
          paquete: { priceId: 'price_1Tv9plE9Iq6fzuQIPU1eNKqe', totalPrice: 71.4, unitPrice: 14.28, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv9plE9Iq6fzuQIAAQJILuo', totalPrice: 125.66, unitPrice: 12.57, quantity: 10 }
        }
      },
      tripadvisor: {
        productId: 'prod_UuztzDNvWLmCMA',
        quantityMode: 'package',
        packages: {
          sencilla: { priceId: 'price_1Tv9uAE9Iq6fzuQIluaOlXJA', totalPrice: 23.99, unitPrice: 23.99, quantity: 1 },
          doble: { priceId: 'price_1Tv9wDE9Iq6fzuQIIj1sctRQ', totalPrice: 36.56, unitPrice: 18.28, quantity: 2 },
          paquete: { priceId: 'price_1Tv9wDE9Iq6fzuQIPRfifuJw', totalPrice: 71.4, unitPrice: 14.28, quantity: 5 },
          'mega-pack': { priceId: 'price_1Tv9wDE9Iq6fzuQIIm62pTKP', totalPrice: 125.66, unitPrice: 12.57, quantity: 10 }
        }
      }
    }
  };

  window.TaploeEcommerce = {
    stripePublishableKey: 'pk_live_51TtqDIE9Iq6fzuQICgG0SyFWRhjnpUtT77TxlNhLgYhdo4X36yrsnwennQj5Ghj6aLF5zmDxQxgfFyikD2HBWTk000JvfqlMtF',
    supabaseUrl: 'https://gmpiygcnzlxllnablxmk.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcGl5Z2Nuemx4bGxuYWJseG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE1NjUsImV4cCI6MjA5OTE4NzU2NX0.3xYOvjvjuoNJW5DXemn0VaNUnC1IifluBjHVSa_uKBs',
    market,
    locale,
    currency: market === 'us' ? 'USD' : 'MXN',
    cartStorageKey: `taploeCart:${market}`,
    orderStorageKey: `taploeCheckoutOrderId:${market}`,
    pendingCheckoutStorageKey: `taploePendingCheckout:${market}`,
    webCartCheckoutFunction: 'create-web-cart-checkout-session',
    webCartCompleteFunction: 'complete-checkout-order',
    checkoutMode: 'payment',
    appLoginUrl: market === 'us' ? 'https://app.taploe.com/login?locale=en-US' : 'https://app.taploe.com/login?locale=es-MX',
    productsByMarket,
    products: productsByMarket[market] || productsByMarket.mx
  };
})();
