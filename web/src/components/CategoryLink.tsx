import { categorySlug } from "../lib/categories";
import { navigate, routePath } from "../lib/route";

/** Link to a category page; a real href (opens in a new tab with ⌘-click) that navigates in place. */
export function CategoryLink({ category }: { category: string }) {
  const route = { page: "category" as const, slug: categorySlug(category) };
  return (
    <a
      href={routePath(route)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(route);
      }}
    >
      {category}
    </a>
  );
}
