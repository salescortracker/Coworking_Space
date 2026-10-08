/**
 * Development configuration (ng serve). Every API call goes through environment.apiUrl;
 * no service or component contains its own API address.
 * Point these at the Officera API started with `dotnet run --launch-profile https` in officera_API/officera_API.
 */
export const environment = {
  production: false,
  apiUrl: 'https://localhost:7232/api',
  baseurl: 'https://localhost:7232',
};
