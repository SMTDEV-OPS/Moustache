import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { disableCheckInDate, disableCheckoutDate, startOfDay } from "@/lib/leadDates";
import type { LeadFormData } from "./useLeadForm";

interface HotelStayDateFieldsProps {
  index: number;
  form: UseFormReturn<LeadFormData>;
  checkInLabel?: string;
  checkOutLabel?: string;
}

export function HotelStayDateFields({
  index,
  form,
  checkInLabel = "Check-in *",
  checkOutLabel = "Check-out *",
}: HotelStayDateFieldsProps) {
  const checkIn = form.watch(`hotels.${index}.checkInDate`);

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name={`hotels.${index}.checkInDate`}
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>{checkInLabel}</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value || undefined}
                  onSelect={(date) => {
                    field.onChange(date);
                    const checkOut = form.getValues(`hotels.${index}.checkOutDate`);
                    if (date && checkOut && startOfDay(checkOut) < startOfDay(date)) {
                      form.setValue(`hotels.${index}.checkOutDate`, undefined as unknown as Date);
                    }
                  }}
                  disabled={disableCheckInDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`hotels.${index}.checkOutDate`}
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>{checkOutLabel}</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value || undefined}
                  onSelect={field.onChange}
                  disabled={(date) => disableCheckoutDate(date, checkIn || null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
