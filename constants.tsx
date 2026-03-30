
import React from 'react';

export const SERVICES = [
  {
    id: 'parcels',
    name: 'Parcels',
    description: 'Send anything instantly',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpKbpSea_Q5mkSbWGkhBg4luvhJ85DOSZi5gcOsaT5Fo7dbc-8CyRJ8UgwPWSvXt2HHqSdP-JYhC04LXE54O7Pj4tLuh2L3dC2yzGueU2OREkYZwhrcy0UP95yM1ruCayzUMwxti4Q5cExlQz49n9VBTmPW8ixbVOdWB46pt49SdqdlEebS_5yVHDUGjB6SYqtQjj2a4n9t2W3bEf0u86y5UmRNTcHO33p0GS4iWZcOgdPkiW2pg9m-xRvvSok_umdQz3OB7V-IQ',
    icon: 'package_2',
    color: 'from-amber-400 to-orange-500',
    tag: 'POPULAR'
  },
  {
    id: 'reverse-parcels',
    name: 'Reverse Parcels',
    description: 'Hassle-free returns',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ2YbyciCoqLErdoVQG1Fu3LuV61DJIoJ_xH5QR9cidg2yFGK7lGq0gvpUqORPapKwyUNS8wG6uwvXOaUKnUFhopF1ZzSSnBXE1ew8G78wLFrwhGzLB3AZq3ICnp0d2Q7v-uWKwi00uSFKEiusiKK_0sDPpnezDOa-im4wAXjhPzQQBWG3RVsMx4tBV_YvXwkcZCKvfHUf8LIoeFjuPER-Q3qo-2iT9ifRSXmaD_JwIafiOfH4ssJX6jL6U4t2v07QEtoQldP3aw',
    icon: 'assignment_return',
    color: 'from-purple-500 to-indigo-600',
    tag: 'NEW'
  },
  {
    id: 'exchange',
    name: 'Exchange',
    description: 'Send & receive items in one trip',
    image: '',
    icon: 'swap_horiz',
    color: 'from-rose-500 to-pink-600',
    tag: 'NEW'
  }
];

export const VEHICLE_TYPES = [
  {
    id: 'bike',
    name: 'Bike',
    capacity: 'Max 20kg',
    price: 140,
    time: '8 min',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyBW-UJRhGmL3yQF7voayjVv569iyP_Ys-hScj4dr8Nikzo53I05xNlKO08ZfSoOiAc49hUXd1oq7PC8ZE9pA3763v2FGmc1j-SYauDhOdZbfc7z0yf0YGDTzh_cJKmH05GNzRTVtQzktKKanEmVyPDcrH4T4V_f5kvkm61uTDOBJA5WpuegF3zZunI7s_umnPW_NWOrZx920RNEx2BJLyMYn7NYvtVnj1C9EsAouS1_cAELsT8Gjy7TuOFr147VtpiKOgcMnx6w',
  },
  {
    id: 'car',
    name: 'Car',
    capacity: 'Max 200kg',
    price: 250,
    time: '10 min',
    image: '',
    icon: 'directions_car',
  },
  {
    id: 'tata-ace',
    name: 'Mini Truck (Tata Ace)',
    capacity: 'Max 750kg',
    price: 450,
    time: '15 min',
    image: '',
    icon: 'local_shipping',
    bestValue: true,
  },
  {
    id: 'bolero',
    name: 'Pickup Truck (Bolero)',
    capacity: 'Max 1500kg',
    price: 700,
    time: '20 min',
    image: '',
    icon: 'local_shipping',
  },
  {
    id: 'tata-407',
    name: 'Medium Truck (Tata 407)',
    capacity: 'Max 3500kg',
    price: 1200,
    time: '25 min',
    image: '',
    icon: 'local_shipping',
  },
  {
    id: 'large-truck',
    name: 'Large Truck',
    capacity: 'Max 8000kg',
    price: 2500,
    time: '30 min',
    image: '',
    icon: 'local_shipping',
  }
];
