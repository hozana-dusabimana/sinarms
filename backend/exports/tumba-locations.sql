-- SINARMS Tumba export from live DB (sinarms) on 2026-06-12T00:10:16Z
-- Location: loc-rp-tumba-main (RP Tumba College - Main Campus)
-- MySQL dump 10.13  Distrib 8.4.6-6, for Linux (aarch64)
--
-- Host: 127.0.0.1    Database: sinarms
-- ------------------------------------------------------
-- Server version	8.4.6-6

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!50717 SELECT COUNT(*) INTO @rocksdb_has_p_s_session_variables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'performance_schema' AND TABLE_NAME = 'session_variables' */;
/*!50717 SET @rocksdb_get_is_supported = IF (@rocksdb_has_p_s_session_variables, 'SELECT COUNT(*) INTO @rocksdb_is_supported FROM performance_schema.session_variables WHERE VARIABLE_NAME=\'rocksdb_bulk_load\'', 'SELECT 0') */;
/*!50717 PREPARE s FROM @rocksdb_get_is_supported */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;
/*!50717 SET @rocksdb_enable_bulk_load = IF (@rocksdb_is_supported, 'SET SESSION rocksdb_bulk_load = 1', 'SET @rocksdb_dummy_bulk_load = 0') */;
/*!50717 PREPARE s FROM @rocksdb_enable_bulk_load */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;

--
-- Dumping data for table `locations`
--
-- WHERE:  id='loc-rp-tumba-main'

LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
INSERT INTO `locations` (`id`, `organization_id`, `name`, `address`, `floor_count`, `description`, `status`, `qr_code_token`, `receptionist_ids`, `created_at`) VALUES ('loc-rp-tumba-main','org-rp-tumba','RP Tumba College - Main Campus','Tumba, Rulindo District, Northern Province, Rwanda',1,'RP Tumba College main campus covering the academic block (Clinic, IT/ET labs, Renewable Energy facilities, Academic Services), workshops (Mechanical, Electrical, DC Machine, Incubation Center), administration block (Administrator, Board Room, Department Principal, Main Hall) and student facilities (Library, Restaurants, Hostels).','active','SINARMS-TUMBA-MAIN','[\"user-rec-2\"]','2026-04-20 03:17:15.765');
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;
/*!50112 SET @disable_bulk_load = IF (@is_rocksdb_supported, 'SET SESSION rocksdb_bulk_load = @old_rocksdb_bulk_load', 'SET @dummy_rocksdb_bulk_load = 0') */;
/*!50112 PREPARE s FROM @disable_bulk_load */;
/*!50112 EXECUTE s */;
/*!50112 DEALLOCATE PREPARE s */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-12  0:10:16
-- MySQL dump 10.13  Distrib 8.4.6-6, for Linux (aarch64)
--
-- Host: 127.0.0.1    Database: sinarms
-- ------------------------------------------------------
-- Server version	8.4.6-6

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!50717 SELECT COUNT(*) INTO @rocksdb_has_p_s_session_variables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'performance_schema' AND TABLE_NAME = 'session_variables' */;
/*!50717 SET @rocksdb_get_is_supported = IF (@rocksdb_has_p_s_session_variables, 'SELECT COUNT(*) INTO @rocksdb_is_supported FROM performance_schema.session_variables WHERE VARIABLE_NAME=\'rocksdb_bulk_load\'', 'SELECT 0') */;
/*!50717 PREPARE s FROM @rocksdb_get_is_supported */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;
/*!50717 SET @rocksdb_enable_bulk_load = IF (@rocksdb_is_supported, 'SET SESSION rocksdb_bulk_load = 1', 'SET @rocksdb_dummy_bulk_load = 0') */;
/*!50717 PREPARE s FROM @rocksdb_enable_bulk_load */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;

--
-- Dumping data for table `map_nodes`
--
-- WHERE:  location_id='loc-rp-tumba-main'

LOCK TABLES `map_nodes` WRITE;
/*!40000 ALTER TABLE `map_nodes` DISABLE KEYS */;
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('academic-services-unit','loc-rp-tumba-main','Academic Services Unit','[\"academic services\", \"asu\", \"registrar\", \"academic services unit\"]','office','public',-1423.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('administrative-staff-office','loc-rp-tumba-main','Administrative Staff Office','[\"administrative staff\", \"admin staff office\"]','office','public',-1413.00,2494.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('administrator-office','loc-rp-tumba-main','Administrator Office','[\"administrator\", \"administrator office\"]','office','public',-1418.00,2494.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('board-room','loc-rp-tumba-main','Board Room','[\"board room\", \"boardroom\"]','office','public',-1413.00,2494.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('business-incubation-center','loc-rp-tumba-main','Business Incubation Center','[\"business incubation\", \"incubation centre\", \"bic\", \"business incubation center\"]','office','public',-1426.00,2499.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('career-support-office','loc-rp-tumba-main','Career Support Office','[\"career support\", \"career office\", \"cso\", \"career support office\"]','office','public',-1424.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('clinic','loc-rp-tumba-main','Clinic','[\"clinic\", \"medical room\", \"health centre\", \"ivuriro\"]','office','public',-1422.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('common-course-department','loc-rp-tumba-main','Common Course Department','[\"common course\", \"common course department\", \"ccd\"]','office','public',-1423.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('dc-machine-lab','loc-rp-tumba-main','DC Machine Lab','[\"dc machine lab\", \"dc lab\", \"dc machines\"]','office','public',-1424.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('electrical-workshop','loc-rp-tumba-main','Electrical Workshop','[\"electrical workshop\", \"elec workshop\"]','office','public',-1417.00,2495.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('enjoy-restaurant','loc-rp-tumba-main','Enjoy Restaurant','[\"enjoy restaurant\", \"cafeteria\", \"canteen\"]','office','public',-1421.00,2490.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('entrance','loc-rp-tumba-main','Main Entrance','[\"entrance\", \"main gate\", \"gate\", \"irembo\", \"site entrance\"]','checkpoint','public',-1413.00,2494.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('et-lab-2','loc-rp-tumba-main','ET Lab II','[\"et lab 2\", \"et lab ii\", \"electrical lab two\"]','office','public',-1422.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('ett-lab-3','loc-rp-tumba-main','ETT Lab III','[\"ett lab 3\", \"ett lab iii\", \"ett lab\", \"electronics telecom lab\"]','office','public',-1422.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('examination-test-room','loc-rp-tumba-main','Examination Test Room','[\"exam room\", \"examination room\", \"test room\", \"examination test room\"]','office','public',-1423.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('gb-hostel','loc-rp-tumba-main','GB Hostel','[\"gb hostel\", \"girls hostel\"]','office','public',-1421.00,2490.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('it-lab-1','loc-rp-tumba-main','IT Lab I','[\"it lab 1\", \"it lab i\", \"it lab one\"]','office','public',-1418.00,2495.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('it-lab-2','loc-rp-tumba-main','IT Lab II','[\"it lab 2\", \"it lab ii\", \"it lab two\"]','office','public',-1423.00,2499.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('it-lab-3','loc-rp-tumba-main','IT Lab III','[\"it lab 3\", \"it lab iii\", \"it lab three\"]','office','public',-1423.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('it-lab-4','loc-rp-tumba-main','IT Lab IV','[\"it lab 4\", \"it lab iv\", \"it lab four\"]','office','public',-1421.00,2495.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('it-lab-6','loc-rp-tumba-main','IT Lab 6','[\"it lab 6\", \"it lab six\"]','office','public',-1426.00,2499.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('it-lab-7','loc-rp-tumba-main','IT Lab 7','[\"it lab 7\", \"it lab seven\"]','office','public',-1426.00,2499.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('library','loc-rp-tumba-main','Library','[\"library\", \"isomero\"]','office','public',-1420.00,2489.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('main-hall','loc-rp-tumba-main','Main Hall','[\"main hall\", \"auditorium\"]','office','public',-1416.00,2495.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('mechanical-workshop','loc-rp-tumba-main','Mechanical Workshop','[\"mechanical workshop\", \"mech workshop\"]','office','public',-1417.00,2495.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('nb-hostel','loc-rp-tumba-main','NB Hostel','[\"nb hostel\", \"boys hostel\"]','office','public',-1421.00,2490.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('network-lab','loc-rp-tumba-main','Network Lab','[\"network lab\", \"networking lab\"]','office','public',-1422.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781216819541','loc-rp-tumba-main','Dc Machine Lab','[]','office','public',-1416.00,2495.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781216916303','loc-rp-tumba-main','Electrical workshop','[]','office','public',-1418.00,2495.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781217049696','loc-rp-tumba-main','Server room','[]','office','public',-1422.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781217268369','loc-rp-tumba-main','Academic service unit','[]','office','public',-1423.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781217324401','loc-rp-tumba-main','Renewable Energy Lab','[]','office','public',-1424.00,2499.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781217570089','loc-rp-tumba-main','IT Department ','[]','office','public',-1426.00,2499.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781218088082','loc-rp-tumba-main','Renewable Energy store','[]','office','public',-1420.00,2496.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('node-1781218514157','loc-rp-tumba-main','Language Center','[]','office','public',-1420.00,2489.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('office-of-department-principal','loc-rp-tumba-main','Office of the Department Principal','[\"principal office\", \"department principal\", \"department principle\", \"office of department principal\"]','office','public',-1413.00,2493.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('office-of-procurement','loc-rp-tumba-main','Office of the Procurement','[\"procurement\", \"procurement office\", \"office of the procurement\"]','office','public',-1416.00,2494.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('renewable-energy-department','loc-rp-tumba-main','Renewable Energy Department','[\"renewable energy department\", \"re department\"]','office','public',-1427.00,2501.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('renewable-energy-lab','loc-rp-tumba-main','Renewable Energy Lab','[\"renewable energy lab\", \"re lab\"]','office','public',-1423.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('rooftop-restaurant','loc-rp-tumba-main','Rooftop Restaurant','[\"rooftop restaurant\", \"roof restaurant\"]','office','public',-1420.00,2489.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('server-room','loc-rp-tumba-main','Server Room','[\"server room\", \"data centre\", \"servers\"]','office','public',-1423.00,2498.00,1);
INSERT INTO `map_nodes` (`id`, `location_id`, `label`, `aliases`, `type`, `zone`, `x`, `y`, `floor`) VALUES ('toilets','loc-rp-tumba-main','Toilets','[\"toilet\", \"toilette\", \"toilets\", \"wc\", \"restroom\", \"umusarani\"]','office','public',-1422.00,2498.00,1);
/*!40000 ALTER TABLE `map_nodes` ENABLE KEYS */;
UNLOCK TABLES;
/*!50112 SET @disable_bulk_load = IF (@is_rocksdb_supported, 'SET SESSION rocksdb_bulk_load = @old_rocksdb_bulk_load', 'SET @dummy_rocksdb_bulk_load = 0') */;
/*!50112 PREPARE s FROM @disable_bulk_load */;
/*!50112 EXECUTE s */;
/*!50112 DEALLOCATE PREPARE s */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-12  0:10:16
-- MySQL dump 10.13  Distrib 8.4.6-6, for Linux (aarch64)
--
-- Host: 127.0.0.1    Database: sinarms
-- ------------------------------------------------------
-- Server version	8.4.6-6

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!50717 SELECT COUNT(*) INTO @rocksdb_has_p_s_session_variables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'performance_schema' AND TABLE_NAME = 'session_variables' */;
/*!50717 SET @rocksdb_get_is_supported = IF (@rocksdb_has_p_s_session_variables, 'SELECT COUNT(*) INTO @rocksdb_is_supported FROM performance_schema.session_variables WHERE VARIABLE_NAME=\'rocksdb_bulk_load\'', 'SELECT 0') */;
/*!50717 PREPARE s FROM @rocksdb_get_is_supported */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;
/*!50717 SET @rocksdb_enable_bulk_load = IF (@rocksdb_is_supported, 'SET SESSION rocksdb_bulk_load = 1', 'SET @rocksdb_dummy_bulk_load = 0') */;
/*!50717 PREPARE s FROM @rocksdb_enable_bulk_load */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;

--
-- Dumping data for table `map_edges`
--
-- WHERE:  location_id='loc-rp-tumba-main'

LOCK TABLES `map_edges` WRITE;
/*!40000 ALTER TABLE `map_edges` DISABLE KEYS */;
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-academic-services-unit--clinic','loc-rp-tumba-main','academic-services-unit','clinic',11.00,'straight','Walk straight from the Academic Services Unit to the Clinic.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-academic-services-unit--dc-machine-lab','loc-rp-tumba-main','academic-services-unit','dc-machine-lab',11.00,'straight','Walk straight from the Academic Services Unit to the DC Machine Lab.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-academic-services-unit--renewable-energy-lab','loc-rp-tumba-main','academic-services-unit','renewable-energy-lab',1.00,'straight','Walk straight from the Academic Services Unit to the Renewable Energy Lab.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-academic-services-unit--server-room','loc-rp-tumba-main','academic-services-unit','server-room',1.00,'straight','Walk straight from the Academic Services Unit to the Server Room.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-academic-services-unit--toilets','loc-rp-tumba-main','academic-services-unit','toilets',1.00,'straight','Walk straight from the Academic Services Unit to the Toilets.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-administrative-staff-office--board-room','loc-rp-tumba-main','administrative-staff-office','board-room',1.00,'straight','Walk straight from the Administrative Staff Office to the Board Room.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-administrative-staff-office--office-of-department-princi','loc-rp-tumba-main','administrative-staff-office','office-of-department-principal',1.00,'straight','Walk straight from the Administrative Staff Office to the Office of the Department Principal.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-administrative-staff-office--office-of-procurement','loc-rp-tumba-main','administrative-staff-office','office-of-procurement',1.00,'straight','Walk straight from the Administrative Staff Office to the Office of the Procurement.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-administrator-office--main-hall','loc-rp-tumba-main','administrator-office','main-hall',44.00,'straight','Walk straight from the Administrator Office to the Main Hall.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-administrator-office--mechanical-workshop','loc-rp-tumba-main','administrator-office','mechanical-workshop',16.00,'straight','Walk straight from the Administrator Office to the Mechanical Workshop.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-board-room--office-of-department-princi','loc-rp-tumba-main','board-room','office-of-department-principal',1.00,'straight','Walk straight from the Board Room to the Office of the Department Principal.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-board-room--office-of-procurement','loc-rp-tumba-main','board-room','office-of-procurement',1.00,'straight','Walk straight from the Board Room to the Office of the Procurement.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-business-incubation-center--career-support-office','loc-rp-tumba-main','business-incubation-center','career-support-office',1.00,'straight','Walk straight from the Business Incubation Center to the Career Support Office.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-business-incubation-center--common-course-department','loc-rp-tumba-main','business-incubation-center','common-course-department',1.00,'straight','Walk straight from the Business Incubation Center to the Common Course Department.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-business-incubation-center--it-lab-6','loc-rp-tumba-main','business-incubation-center','it-lab-6',11.00,'straight','Walk straight from the Business Incubation Center to the IT Lab 6.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-business-incubation-center--it-lab-7','loc-rp-tumba-main','business-incubation-center','it-lab-7',1.00,'straight','Walk straight from the Business Incubation Center to the IT Lab 7.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-career-support-office--common-course-department','loc-rp-tumba-main','career-support-office','common-course-department',1.00,'straight','Walk straight from the Career Support Office to the Common Course Department.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-career-support-office--it-lab-7','loc-rp-tumba-main','career-support-office','it-lab-7',1.00,'straight','Walk straight from the Career Support Office to the IT Lab 7.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-clinic--et-lab-2','loc-rp-tumba-main','clinic','et-lab-2',1.00,'straight','Walk straight from the Clinic to the ET Lab II.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-clinic--ett-lab-3','loc-rp-tumba-main','clinic','ett-lab-3',1.00,'straight','Walk straight from the Clinic to the ETT Lab III.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-clinic--it-lab-1','loc-rp-tumba-main','clinic','it-lab-1',1.00,'straight','Walk straight from the Clinic to the IT Lab I.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-clinic--it-lab-2','loc-rp-tumba-main','clinic','it-lab-2',16.00,'straight','Walk straight from the Clinic to the IT Lab II.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-clinic--it-lab-4','loc-rp-tumba-main','clinic','it-lab-4',1.00,'straight','Walk straight from the Clinic to the IT Lab IV.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-common-course-department--it-lab-7','loc-rp-tumba-main','common-course-department','it-lab-7',1.00,'straight','Walk straight from the Common Course Department to the IT Lab 7.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-dc-machine-lab--examination-test-room','loc-rp-tumba-main','dc-machine-lab','examination-test-room',11.00,'straight','Walk straight from the DC Machine Lab to the Examination Test Room.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-dc-machine-lab--network-lab','loc-rp-tumba-main','dc-machine-lab','network-lab',1.00,'straight','Walk straight from the DC Machine Lab to the Network Lab.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-electrical-workshop--administrator-office','loc-rp-tumba-main','electrical-workshop','administrator-office',16.00,'straight','Walk straight from the Electrical Workshop to the Administrator Office.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-electrical-workshop--main-hall','loc-rp-tumba-main','electrical-workshop','main-hall',35.00,'straight','Walk straight from the Electrical Workshop to the Main Hall.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-electrical-workshop--mechanical-workshop','loc-rp-tumba-main','electrical-workshop','mechanical-workshop',1.00,'straight','Walk straight from the Electrical Workshop to the Mechanical Workshop.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-enjoy-restaurant--entrance','loc-rp-tumba-main','enjoy-restaurant','entrance',31.00,'straight','Walk straight from the Enjoy Restaurant to the Main Entrance.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-enjoy-restaurant--gb-hostel','loc-rp-tumba-main','enjoy-restaurant','gb-hostel',1.00,'straight','Walk straight from the Enjoy Restaurant to the GB Hostel.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-enjoy-restaurant--nb-hostel','loc-rp-tumba-main','enjoy-restaurant','nb-hostel',1.00,'straight','Walk straight from the Enjoy Restaurant to the NB Hostel.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-entrance--gb-hostel','loc-rp-tumba-main','entrance','gb-hostel',31.00,'straight','Walk straight from the Main Entrance to the GB Hostel.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-entrance--nb-hostel','loc-rp-tumba-main','entrance','nb-hostel',31.00,'straight','Walk straight from the Main Entrance to the NB Hostel.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-et-lab-2--ett-lab-3','loc-rp-tumba-main','et-lab-2','ett-lab-3',1.00,'straight','Walk straight from the ET Lab II to the ETT Lab III.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-et-lab-2--it-lab-1','loc-rp-tumba-main','et-lab-2','it-lab-1',1.00,'straight','Walk straight from the ET Lab II to the IT Lab I.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-ett-lab-3--it-lab-1','loc-rp-tumba-main','ett-lab-3','it-lab-1',1.00,'straight','Walk straight from the ETT Lab III to the IT Lab I.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-examination-test-room--business-incubation-center','loc-rp-tumba-main','examination-test-room','business-incubation-center',16.00,'straight','Walk straight from the Examination Test Room to the Business Incubation Center.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-examination-test-room--network-lab','loc-rp-tumba-main','examination-test-room','network-lab',11.00,'straight','Walk straight from the Examination Test Room to the Network Lab.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-gb-hostel--nb-hostel','loc-rp-tumba-main','gb-hostel','nb-hostel',1.00,'straight','Walk straight from the GB Hostel to the NB Hostel.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-gb-hostel--rooftop-restaurant','loc-rp-tumba-main','gb-hostel','rooftop-restaurant',16.00,'straight','Walk straight from the GB Hostel to the Rooftop Restaurant.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-2--et-lab-2','loc-rp-tumba-main','it-lab-2','et-lab-2',16.00,'straight','Walk straight from the IT Lab II to the ET Lab II.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-2--it-lab-3','loc-rp-tumba-main','it-lab-2','it-lab-3',11.00,'straight','Walk straight from the IT Lab II to the IT Lab III.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-3--clinic','loc-rp-tumba-main','it-lab-3','clinic',25.00,'straight','Walk straight from the IT Lab III to the Clinic.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-3--electrical-workshop','loc-rp-tumba-main','it-lab-3','electrical-workshop',56.00,'straight','Walk straight from the IT Lab III to the Electrical Workshop.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-3--et-lab-2','loc-rp-tumba-main','it-lab-3','et-lab-2',25.00,'straight','Walk straight from the IT Lab III to the ET Lab II.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-4--et-lab-2','loc-rp-tumba-main','it-lab-4','et-lab-2',1.00,'straight','Walk straight from the IT Lab IV to the ET Lab II.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-4--ett-lab-3','loc-rp-tumba-main','it-lab-4','ett-lab-3',1.00,'straight','Walk straight from the IT Lab IV to the ETT Lab III.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-6--career-support-office','loc-rp-tumba-main','it-lab-6','career-support-office',11.00,'straight','Walk straight from the IT Lab 6 to the Career Support Office.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-6--common-course-department','loc-rp-tumba-main','it-lab-6','common-course-department',11.00,'straight','Walk straight from the IT Lab 6 to the Common Course Department.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-it-lab-6--renewable-energy-department','loc-rp-tumba-main','it-lab-6','renewable-energy-department',16.00,'straight','Walk straight from the IT Lab 6 to the Renewable Energy Department.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-library--administrative-staff-office','loc-rp-tumba-main','library','administrative-staff-office',50.00,'straight','Walk straight from the Library to the Administrative Staff Office.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-library--board-room','loc-rp-tumba-main','library','board-room',50.00,'straight','Walk straight from the Library to the Board Room.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-library--rooftop-restaurant','loc-rp-tumba-main','library','rooftop-restaurant',57.00,'straight','Walk straight from the Library to the Rooftop Restaurant.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-main-hall--administrative-staff-office','loc-rp-tumba-main','main-hall','administrative-staff-office',11.00,'straight','Walk straight from the Main Hall to the Administrative Staff Office.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-main-hall--board-room','loc-rp-tumba-main','main-hall','board-room',11.00,'straight','Walk straight from the Main Hall to the Board Room.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-main-hall--library','loc-rp-tumba-main','main-hall','library',46.00,'straight','Walk straight from the Main Hall to the Library.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-main-hall--office-of-department-princi','loc-rp-tumba-main','main-hall','office-of-department-principal',11.00,'straight','Walk straight from the Main Hall to the Office of the Department Principal.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-mechanical-workshop--main-hall','loc-rp-tumba-main','mechanical-workshop','main-hall',35.00,'straight','Walk straight from the Mechanical Workshop to the Main Hall.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-nb-hostel--rooftop-restaurant','loc-rp-tumba-main','nb-hostel','rooftop-restaurant',16.00,'straight','Walk straight from the NB Hostel to the Rooftop Restaurant.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-network-lab--academic-services-unit','loc-rp-tumba-main','network-lab','academic-services-unit',11.00,'straight','Walk straight from the Network Lab to the Academic Services Unit.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-office-of-department-princi--office-of-procurement','loc-rp-tumba-main','office-of-department-principal','office-of-procurement',1.00,'straight','Walk straight from the Office of the Department Principal to the Office of the Procurement.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-renewable-energy-department--business-incubation-center','loc-rp-tumba-main','renewable-energy-department','business-incubation-center',25.00,'straight','Walk straight from the Renewable Energy Department to the Business Incubation Center.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-renewable-energy-department--career-support-office','loc-rp-tumba-main','renewable-energy-department','career-support-office',25.00,'straight','Walk straight from the Renewable Energy Department to the Career Support Office.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-renewable-energy-lab--server-room','loc-rp-tumba-main','renewable-energy-lab','server-room',1.00,'straight','Walk straight from the Renewable Energy Lab to the Server Room.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-renewable-energy-lab--toilets','loc-rp-tumba-main','renewable-energy-lab','toilets',1.00,'straight','Walk straight from the Renewable Energy Lab to the Toilets.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-rooftop-restaurant--enjoy-restaurant','loc-rp-tumba-main','rooftop-restaurant','enjoy-restaurant',16.00,'straight','Walk straight from the Rooftop Restaurant to the Enjoy Restaurant.',1);
INSERT INTO `map_edges` (`id`, `location_id`, `from_node_id`, `to_node_id`, `distance_m`, `direction`, `direction_hint`, `is_accessible`) VALUES ('path-server-room--toilets','loc-rp-tumba-main','server-room','toilets',1.00,'straight','Walk straight from the Server Room to the Toilets.',1);
/*!40000 ALTER TABLE `map_edges` ENABLE KEYS */;
UNLOCK TABLES;
/*!50112 SET @disable_bulk_load = IF (@is_rocksdb_supported, 'SET SESSION rocksdb_bulk_load = @old_rocksdb_bulk_load', 'SET @dummy_rocksdb_bulk_load = 0') */;
/*!50112 PREPARE s FROM @disable_bulk_load */;
/*!50112 EXECUTE s */;
/*!50112 DEALLOCATE PREPARE s */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-12  0:10:16
