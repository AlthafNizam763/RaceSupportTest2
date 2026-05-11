import { NextRequest } from "next/server";

import { listCmsCollections } from "@/lib/server/cms-config";
import { listDocuments } from "@/lib/server/firestore";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  try {
    const collections = listCmsCollections().filter((collection) => collection.key !== "settings");
    const entries = await Promise.all(
      collections.map(async (collection) => [
        collection.key,
        await listDocuments(collection.collectionName, collection.sortable),
      ] as const)
    );

    const dataMap = Object.fromEntries(entries);
    const events = dataMap.events as Array<Record<string, any>>;
    const projects = dataMap.projects as Array<Record<string, any>>;
    const tickets = dataMap.tickets as Array<Record<string, any>>;
    const gallery = dataMap.gallery as Array<Record<string, any>>;
    const team = dataMap.team as Array<Record<string, any>>;
    const changemakers = dataMap.changemakers as Array<Record<string, any>>;
    const courses = dataMap.courses as Array<Record<string, any>>;
    const news = dataMap.news as Array<Record<string, any>>;

    const ongoingEvents = events.filter((event) => event.status === "Ongoing").length;
    const pastEvents = events.filter((event) => event.status === "Past").length;
    const openTickets = tickets.filter((ticket) => ticket.status === "Open").length;
    const inProgressTickets = tickets.filter((ticket) => ticket.status === "In Progress").length;
    const resolvedTickets = tickets.filter((ticket) => ticket.status === "Resolved").length;
    const galleryImages = gallery.filter((item) => item.type === "image").length;
    const galleryVideos = gallery.filter((item) => item.type === "video").length;

    const response = successResponse(
      {
        cards: {
          totalEvents: events.length,
          ongoingEvents,
          totalProjects: projects.length,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          totalTeamMembers: team.length,
          totalChangemakers: changemakers.length,
          totalGalleryItems: gallery.length,
          galleryImages,
          galleryVideos,
          totalCourses: courses.length,
          totalNews: news.length,
        },
        charts: {
          moduleCounts: [
            { name: "Events", total: events.length },
            { name: "Projects", total: projects.length },
            { name: "Courses", total: courses.length },
            { name: "News", total: news.length },
            { name: "Gallery", total: gallery.length },
            { name: "Tickets", total: tickets.length },
          ],
          statusBreakdown: [
            { name: "Open", tickets: openTickets, events: 0 },
            { name: "In Progress", tickets: inProgressTickets, events: 0 },
            { name: "Resolved", tickets: resolvedTickets, events: 0 },
            { name: "Ongoing", tickets: 0, events: ongoingEvents },
            { name: "Past", tickets: 0, events: pastEvents },
          ],
        },
      },
      "Dashboard analytics loaded successfully."
    );

    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load analytics.", 500);
  }
}
