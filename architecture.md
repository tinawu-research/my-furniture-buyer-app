# Data Model

This describes the information the app needs to remember, based on what
we've built so far: a logged-in customer browses a product catalogue and
places orders that get checked against their budget.

It maps directly onto the four tables already created in
[supabase/schema.sql](./supabase/schema.sql): `profiles`, `products`,
`orders`, `order_items`.

## Diagram

```mermaid
classDiagram
    class Customer {
        +UUID id
        +string email
        +numeric budget
    }
    class Product {
        +UUID id
        +string name
        +string description
        +numeric price
        +string imageUrl
        +string category
    }
    class Order {
        +UUID id
        +numeric total
        +datetime createdAt
    }
    class OrderItem {
        +UUID id
        +int quantity
        +numeric price
    }

    Customer "1" --> "0..*" Order : places
    Order "1" --> "1..*" OrderItem : contains
    OrderItem "0..*" --> "1" Product : line item for
```

## Plain English

**Customer** is a shopper. Created automatically the moment someone signs
up (in the code: `profiles`, one row per user). It holds their email and
their `budget` — the total they're allowed to spend, starting at $1000.
We don't store a running "amount left" — that's always calculated by
subtracting the total of all their past orders from this number, so it
can never drift out of sync.

**Product** is one item in the furniture catalogue — a sofa, a lamp, a
bookshelf. It holds a name, description, price, an optional photo, and a
category (e.g. "Living Room"). Products aren't owned by any one customer —
everyone browsing the shop sees the same list.

**Order** is created the moment a customer places an order — it's the
receipt. It remembers who placed it (via its link to Customer), the total
amount charged, and when it happened. A customer can have many orders over
time, but each order belongs to exactly one customer.

**OrderItem** is a single line on that receipt — "2x Bar Stool". An order
usually contains more than one product, so each product-and-quantity pair
in a single order gets its own OrderItem row, all linked back to the same
Order. Each OrderItem also links to the Product it refers to, so we know
*what* was bought.

**Why OrderItem stores its own `price` instead of looking it up from
Product:** product prices can change later (a sofa might go on sale next
month), but a receipt shouldn't change with it. Capturing the price at the
moment of purchase means old orders always show what the customer actually
paid, even if the catalogue price moves afterward.

**Why budget lives on Customer rather than being spread across orders:**
it's a single, simple cap that's checked against the sum of everything a
customer has ever ordered — one number to reason about, rather than
tracking a shrinking balance that has to be carefully decremented (and
could get out of sync if something failed halfway through).
