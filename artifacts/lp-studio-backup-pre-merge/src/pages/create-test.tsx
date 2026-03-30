import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useCreateTest, getListTestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  slug: z.string().min(2, "Slug must be at least 2 characters.").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  testType: z.enum(["ab", "multivariate"]),
});

export default function CreateTest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateTest();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      testType: "ab",
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListTestsQueryKey() });
          toast({
            title: "Test created",
            description: "Your new test has been created successfully.",
          });
          setLocation(`/tests/${data.id}`);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: "Failed to create test. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto pb-12">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-6 -ml-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Create New Experiment</h1>
          <p className="text-muted-foreground mt-2">Configure the baseline settings for your new A/B or multivariate test.</p>
        </div>

        <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/60">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Test Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Q3 Hero Video Conversion" 
                        className="h-12 text-lg rounded-xl bg-muted/20"
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e);
                          if (!form.formState.dirtyFields.slug) {
                            form.setValue("slug", generateSlug(e.target.value));
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>A descriptive name for internal use.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">URL Slug</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <span className="px-3 h-11 flex items-center bg-muted/50 border border-r-0 border-input rounded-l-xl text-muted-foreground text-sm font-mono whitespace-nowrap">
                            /lp/
                          </span>
                          <Input 
                            {...field} 
                            className="h-11 rounded-l-none rounded-r-xl font-mono focus-visible:ring-1 focus-visible:ring-offset-0" 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="testType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Test Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-xl bg-muted/20">
                            <SelectValue placeholder="Select test type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ab">A/B Test</SelectItem>
                          <SelectItem value="multivariate">Multivariate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What are we trying to learn?" 
                        className="resize-none h-24 rounded-xl bg-muted/20"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 border-t flex justify-end">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={createMutation.isPending}
                  className="rounded-xl px-8 shadow-md"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Create Test"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </AppLayout>
  );
}
