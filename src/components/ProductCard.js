export default function ProductCard({ product, quantity, onQuantityChange }) {
  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2">
      <div className="aspect-square bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm overflow-hidden">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          "No image"
        )}
      </div>
      <h3 className="font-semibold">{product.name}</h3>
      <p className="text-sm text-gray-500 flex-1">{product.description}</p>
      <p className="font-medium">${Number(product.price).toFixed(2)}</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
          className="w-8 h-8 rounded border hover:bg-gray-100"
        >
          -
        </button>
        <span className="w-6 text-center">{quantity}</span>
        <button
          type="button"
          onClick={() => onQuantityChange(quantity + 1)}
          className="w-8 h-8 rounded border hover:bg-gray-100"
        >
          +
        </button>
      </div>
    </div>
  );
}
