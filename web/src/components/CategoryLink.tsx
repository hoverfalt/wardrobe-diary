import { categorySlug } from "../lib/categories";
import { Link } from "./Link";

export function CategoryLink({ category }: { category: string }) {
  return <Link to={{ page: "category", slug: categorySlug(category) }}>{category}</Link>;
}
