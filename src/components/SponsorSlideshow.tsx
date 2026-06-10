import { useState, useEffect } from "react";

const products = [
  { id: 1, src: "/sensodie/product1.png", alt: "Sensodyne Deep Clean" },
  { id: 2, src: "/sensodie/product2.png", alt: "Sensodyne Rapid Relief" },
  { id: 3, src: "/sensodie/product3.png", alt: "Sensodyne Repair & Protect" },
  { id: 4, src: "/sensodie/product4.png", alt: "Sensodyne Fresh Mint" },
];

export default function SponsorSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % products.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-3 my-2 bg-white rounded-xl p-3 shadow-md border border-white flex flex-col items-center select-none">
      {/* Sponsor Logo */}
      <div className="w-full flex justify-center pb-2 mb-2 border-b border-slate-100">
        <img
          src="/gold.png"
          alt="Sensodyne Sponsor"
          className="h-14 w-auto object-contain"
        />
      </div>

      {/* Product Slideshow */}
      <div className="relative w-full h-24 flex items-center justify-center overflow-hidden bg-white rounded-lg">
        {products.map((product, idx) => (
          <img
            key={product.id}
            src={product.src}
            alt={product.alt}
            className={`absolute inset-0 w-full h-full object-contain transition-all duration-1000 ease-in-out ${
              idx === currentIndex ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          />
        ))}
      </div>

      {/* Indicators */}
      <div className="flex gap-1.5 mt-2">
        {products.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "bg-[#002f87] w-3"
                : "bg-slate-300 hover:bg-slate-400"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
