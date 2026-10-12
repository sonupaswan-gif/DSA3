import java.util.*;

public class FullTextSearchEngine {

    static class Doc {
        int id;
        String title, text;

        Doc(int id, String title, String text) {
            this.id = id;
            this.title = title;
            this.text = text;
        }
    }

    static ArrayList<Doc> docs = new ArrayList<>();
    static String text = "";
    static int[] sa, lcp;

    public static void main(String[] args) {

        Scanner sc = new Scanner(System.in);


        // 1. Documents
        docs.add(new Doc(1, "Data Structures",
                "Data structures organize and store data efficiently."));
        docs.add(new Doc(2, "Algorithms",
                "Algorithms solve problems using searching and sorting."));
        docs.add(new Doc(3, "Java Programming",
                "Java is a popular programming language."));
        docs.add(new Doc(4, "Database Systems",
                "Database systems store and manage data."));
        docs.add(new Doc(5, "Information Retrieval",
                "Full text search helps users find information quickly."));

        // 2. Combine documents
        for (Doc d : docs)
            text += d.text.toLowerCase() + "#";

        // 3. Build suffix array
        sa = new int[text.length()];
        Integer[] a = new Integer[text.length()];

        for (int i = 0; i < text.length(); i++)
            a[i] = i;

        Arrays.sort(a, (x, y) ->
                text.substring(x).compareTo(text.substring(y)));

        for (int i = 0; i < a.length; i++)
            sa[i] = a[i];

        // 4. Build LCP array using Kasai
        lcp = new int[text.length()];
        int[] rank = new int[text.length()];

        for (int i = 0; i < sa.length; i++)
            rank[sa[i]] = i;

        int k = 0;

        for (int i = 0; i < text.length(); i++) {

            if (rank[i] == text.length() - 1) {
                k = 0;
                continue;
            }

            int j = sa[rank[i] + 1];

            while (i + k < text.length()
                    && j + k < text.length()
                    && text.charAt(i + k) == text.charAt(j + k))
                k++;

            lcp[rank[i]] = k;

            if (k > 0)
                k--;
        }

        // 5. Menu
        while (true) {

            System.out.println("\n========== FULL TEXT SEARCH ==========");
            System.out.println("1. Search");
            System.out.println("2. Display Suffix Array");
            System.out.println("3. Display LCP Array");
            System.out.println("4. Display Documents");
            System.out.println("5. Exit");
            System.out.print("Enter choice: ");

            int choice = Integer.parseInt(sc.nextLine());

            if (choice == 5)
                break;

            if (choice == 1) {

                System.out.print("Enter search query: ");
                String q = sc.nextLine().toLowerCase();

                long start = System.nanoTime();

                ArrayList<String> result = new ArrayList<>();

                for (Doc d : docs) {

                    int count = 0;
                    String s = d.text.toLowerCase();

                    for (int i = 0; i <= s.length() - q.length(); i++)
                        if (s.substring(i, i + q.length()).equals(q))
                            count++;

                    if (count > 0)
                        result.add(d.title + " -> " + count + " occurrence(s)");
                }

                long end = System.nanoTime();

                System.out.println("\n========== SEARCH RESULTS ==========");

                if (result.isEmpty())
                    System.out.println("No matching documents found.");
                else
                    for (int i = 0; i < result.size(); i++)
                        System.out.println("Rank " + (i + 1) + ": " + result.get(i));

                System.out.printf("Query Latency: %.3f ms%n",
                        (end - start) / 1_000_000.0);
            }

            else if (choice == 2) {

                System.out.println("\n========== SUFFIX ARRAY ==========");

                for (int i = 0; i < Math.min(sa.length, 30); i++)
                    System.out.println(
                            i + " -> " + sa[i] + " -> "
                                    + text.substring(sa[i]));
            }

            else if (choice == 3) {

                System.out.println("\n========== LCP ARRAY ==========");

                for (int i = 0; i < Math.min(lcp.length, 30); i++)
                    System.out.println("LCP[" + i + "] = " + lcp[i]);
            }

            else if (choice == 4) {

                System.out.println("\n========== DOCUMENTS ==========");

                for (Doc d : docs)
                    System.out.println(
                            d.id + ". " + d.title + " : " + d.text);
            }

            else {
                System.out.println("Invalid choice.");
            }
        }

        sc.close();
    }
}
