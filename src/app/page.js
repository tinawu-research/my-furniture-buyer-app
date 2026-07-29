// Live product listing from the external Product Search API (Level 2).
// Uses /catalogue/search-index deliberately, not plain /catalogue — the
// latter embeds every product's image as base64 and can take 20+ seconds
// against the real catalogue; search-index returns the same products
// without images, in a fraction of the size and time.
async function getProducts() {
  const baseUrl = process.env.EXTERNAL_API_BASE_URL;
  const res = await fetch(`${baseUrl}/catalogue/search-index?limit=1000`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Catalogue API returned ${res.status}`);
  }
  return res.json();
}

export default async function Home() {
  let products = [];
  let error = null;
  try {
    products = await getProducts();
  } catch (err) {
    error = err.message;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-1">Furniture Catalogue</h1>
      <p className="text-gray-500 mb-6">
        {products.length} products from the shop&apos;s live catalogue API.
      </p>

      {error && (
        <p className="text-red-600 mb-4">
          Couldn&apos;t load the catalogue ({error}). Try refreshing the page.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <div key={product.item_id} className="border rounded-lg p-4 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {product.category}
            </span>
            <h3 className="font-semibold">{product.product_name}</h3>
            <p className="font-medium">${Number(product.price).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
