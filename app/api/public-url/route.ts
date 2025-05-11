
export async function GET() {
    try {
        const response = await fetch("https://deinetuerai-production.up.railway.app/public-url");

        if (!response.ok) {
            return Response.json(
                { error: "No public url provided" },
                { status: response.status }
            );
        }

        const data = await response.json();
        return Response.json(data);
    } catch (error) {
        return Response.json(
            { error: "Server error." },
            { status: 500 }
        );
    }
}
