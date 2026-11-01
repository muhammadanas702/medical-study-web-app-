import { Switch, Route, Router } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/app-context";
import { useHashLocationQ, hashHref } from "@/lib/hash-location";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import SearchPage from "@/pages/search";
import BrowsePage from "@/pages/browse";
import ConceptPage from "@/pages/concept";
import DrugsPage from "@/pages/drugs";
import DrugPage from "@/pages/drug";
import { DevicesPage, DevicePage } from "@/pages/devices";
import { Icd10Page, Icd10CodePage } from "@/pages/icd10";
import LabsPage from "@/pages/labs";
import { TopicsPage, TopicPage } from "@/pages/topics";
import QbankPage from "@/pages/qbank";
import { QuizRunner, QuizReview } from "@/pages/quiz";
import AnalyticsPage from "@/pages/analytics";
import FlashcardsPage from "@/pages/flashcards";
import AtlasPage from "@/pages/atlas";
import { OrgansPage, OrganPage } from "@/pages/organs";
import { PathogensPage, PathogenPage } from "@/pages/pathogens";
import EquipmentPage from "@/pages/equipment";
import DiagramsPage from "@/pages/diagrams";
import { ResearchPage, ArticlePage, TrialsPage } from "@/pages/research";
import { NotesPage, SavedPage } from "@/pages/my";
import SourcesPage from "@/pages/sources";
import { BooksPage, BookPage, BookSectionPage } from "@/pages/books";
import { FiguresPage, FigurePage } from "@/pages/figures";
import { MoleculesPage, MoleculePage } from "@/pages/molecules";
import { SubjectsPage, SubjectPage, UpdatesPage, ArticlesPage, ArticleViewPage } from "@/pages/hub";
import AdminPage from "@/pages/admin";
import { useLocation } from "wouter";

function ScrollTop() {
  const [loc] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc]);
  return null;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/search" component={SearchPage} />
      <Route path="/browse" component={BrowsePage} />
      <Route path="/concept/:id" component={ConceptPage} />
      <Route path="/drugs" component={DrugsPage} />
      <Route path="/drugs/:slug" component={DrugPage} />
      <Route path="/devices" component={DevicesPage} />
      <Route path="/devices/:code" component={DevicePage} />
      <Route path="/icd10" component={Icd10Page} />
      <Route path="/icd10/:code" component={Icd10CodePage} />
      <Route path="/labs" component={LabsPage} />
      <Route path="/topics" component={TopicsPage} />
      <Route path="/topics/:id" component={TopicPage} />
      <Route path="/qbank" component={QbankPage} />
      <Route path="/quiz/:id/review" component={QuizReview} />
      <Route path="/quiz/:id" component={QuizRunner} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/flashcards" component={FlashcardsPage} />
      <Route path="/atlas" component={AtlasPage} />
      <Route path="/organs" component={OrgansPage} />
      <Route path="/organs/:id" component={OrganPage} />
      <Route path="/pathogens" component={PathogensPage} />
      <Route path="/pathogens/:id" component={PathogenPage} />
      <Route path="/equipment" component={EquipmentPage} />
      <Route path="/diagrams" component={DiagramsPage} />
      <Route path="/research" component={ResearchPage} />
      <Route path="/research/:pmid" component={ArticlePage} />
      <Route path="/trials" component={TrialsPage} />
      <Route path="/notes" component={NotesPage} />
      <Route path="/saved" component={SavedPage} />
      <Route path="/sources" component={SourcesPage} />
      <Route path="/books" component={BooksPage} />
      <Route path="/books/:slug" component={BookPage} />
      <Route path="/books/:slug/:id" component={BookSectionPage} />
      <Route path="/figures" component={FiguresPage} />
      <Route path="/figures/:id" component={FigurePage} />
      <Route path="/molecules" component={MoleculesPage} />
      <Route path="/molecules/:cid" component={MoleculePage} />
      <Route path="/subjects" component={SubjectsPage} />
      <Route path="/subjects/:id" component={SubjectPage} />
      <Route path="/updates" component={UpdatesPage} />
      <Route path="/articles" component={ArticlesPage} />
      <Route path="/articles/:id" component={ArticleViewPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocationQ} hrefs={hashHref}>
            <ScrollTop />
            <AppLayout>
              <AppRouter />
            </AppLayout>
          </Router>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
